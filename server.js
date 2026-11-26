import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as xai from "./providers/xai.js";
import * as azure from "./providers/azure.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const SAMPLE_TEXT =
  "Hi there, thanks for calling. How can I help you today?";

const providers = { xai, azure };

// Which providers are configured (so the UI can show status).
app.get("/api/status", (req, res) => {
  res.json({
    xai: xai.isConfigured(),
    azure: azure.isConfigured(),
  });
});

// List voices for a provider.
app.get("/api/voices/:provider", async (req, res) => {
  const p = providers[req.params.provider];
  if (!p) return res.status(404).json({ error: "Unknown provider" });
  if (!p.isConfigured())
    return res.status(503).json({ error: `${req.params.provider} API key not configured` });
  try {
    const voices = await p.listVoices();
    res.json({ voices });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Preview (TTS) a voice.
app.post("/api/preview/:provider", async (req, res) => {
  const p = providers[req.params.provider];
  if (!p) return res.status(404).json({ error: "Unknown provider" });
  if (!p.isConfigured())
    return res.status(503).json({ error: `${req.params.provider} API key not configured` });
  const { voiceId, text, locale } = req.body || {};
  if (!voiceId) return res.status(400).json({ error: "voiceId required" });
  try {
    const { buffer, contentType } = await p.preview(
      voiceId,
      text || SAMPLE_TEXT,
      locale
    );
    res.set("Content-Type", contentType);
    res.send(buffer);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Voice picker running at http://localhost:${PORT}`);
  console.log(`  xAI configured:   ${xai.isConfigured()}`);
  console.log(`  Azure configured: ${azure.isConfigured()}`);
});
