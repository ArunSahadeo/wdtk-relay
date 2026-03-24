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

  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    let feedBody = null;

    // Log every response URL + status
    page.on("response", async (response) => {
      const url = response.url();
      const status = response.status();

      console.log(`RESPONSE: ${status} ${url}`);

      // Capture the feed response
      if (url.startsWith(decoded)) {
        console.log("MATCHED FEED URL:", url);
        try {
          feedBody = await response.text();
          console.log("Captured feed body, length:", feedBody.length);
        } catch (err) {
          console.error("Error reading feed response:", err);
        }
      }
    });

    // Navigate WITHOUT waiting for networkidle
    console.log("Navigating to:", decoded);
    await page.goto(decoded, { timeout: 60000 });

    // Give the response a moment to arrive
    await page.waitForTimeout(2000);

    if (feedBody) {
      res.type("application/xml").send(feedBody);
    } else {
      console.log("No feed body captured");
      res.status(500).send("Failed to capture feed response");
    }

  } catch (err) {
    console.error("Playwright error:", err);
    res.status(500).send("Playwright error: " + err);
  } finally {
    if (browser) await browser.close();
  }
});

app.listen(8080, "0.0.0.0", () => {
  console.log("Relay running on port 8080");
});
