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

    // Intercept the main feed request and capture the raw XML
    await page.route("**/*", async (route) => {
      const request = route.request();

      // We only care about the feed URL (startsWith handles redirects)
      if (request.url().startsWith(decoded)) {
        try {
          const response = await request.response();
          if (response) {
            feedBody = await response.text();
          }
        } catch (err) {
          console.error("Error capturing feed response:", err);
        }
      }

      route.continue();
    });

    // Navigate to the feed URL
    await page.goto(decoded, { waitUntil: "networkidle", timeout: 60000 });

    // If we captured the feed, return it
    if (feedBody) {
      res.type("application/xml").send(feedBody);
    } else {
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
