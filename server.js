import express from "express";
import { chromium } from "playwright";

const app = express();
app.use(express.json());

app.get("/", async (req, res) => {
  const encoded = req.query.encoded_uri;
  if (!encoded) return res.status(400).send("Missing encoded_uri");

  let decoded;
  try {
    decoded = Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return res.status(400).send("Invalid base64");
  }

  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage();

  try {
    await page.goto(decoded, { waitUntil: "networkidle" });
    const content = await page.content();
    res.send(content);
  } catch (err) {
    res.status(500).send("Failed to load page: " + err);
  } finally {
    await browser.close();
  }
});

app.listen(8080, () => console.log("Relay running on port 8080"));

