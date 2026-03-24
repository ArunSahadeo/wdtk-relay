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
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();

  try {
    await page.goto(decoded, { waitUntil: "networkidle" });
    const response = await page.waitForResponse(resp => resp.url() === decoded);
    const body = await response.text();
    res.type("application/xml").send(body);
  } catch (err) {
    res.status(500).send("Failed to load page: " + err);
  } finally {
    await browser.close();
  }
});

app.listen({ host: "0.0.0.0", port: 8080 }, () => console.log("Relay running on port 8080"));
