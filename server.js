import express from "express";
import { chromium } from "playwright";

const app = express();

app.get("/", async (req, res) => {
  const encoded = req.query.encoded_uri;
  if (!encoded) return res.status(400).send("Missing encoded_uri");

  let decoded;
  try {
    decoded = Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return res.status(400).send("Invalid base64");
  }

  let browser;
  let done = false;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    page.on("response", async (response) => {
      if (done) return;

      const url = response.url();
      const status = response.status();
      console.log(`RESPONSE: ${status} ${url}`);

      if (url.startsWith(decoded)) {
        console.log("MATCHED FEED URL:", url);

        try {
          const text = await response.text();

          // Validate XML by checking for the XML declaration
          const xmlIndex = text.indexOf("<?xml");
          if (xmlIndex === -1) {
            console.log("Feed response did not contain XML");
            done = true;
            await browser.close();
            res.status(500).send("Feed did not contain valid XML");
            return;
          }

          const xml = text.slice(xmlIndex);
          console.log("Captured XML feed, length:", xml.length);

          done = true;
          await browser.close();
          res.type("application/xml").send(xml);

        } catch (err) {
          console.error("Error reading feed response:", err);
        }
      }
    });

    console.log("Navigating to:", decoded);
    await page.goto(decoded, { timeout: 60000 });

    // Give the response a moment to arrive
    await page.waitForTimeout(2000);

    if (!done) {
      console.log("No XML feed captured");
      res.status(500).send("Failed to capture XML feed");
    }

  } catch (err) {
    console.error("Playwright error:", err);
    res.status(500).send("Playwright error: " + err);
  } finally {
    if (browser && !done) await browser.close();
  }
});

app.listen(8080, "0.0.0.0", () => {
  console.log("Relay running on port 8080");
});
