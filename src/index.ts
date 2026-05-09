import "dotenv/config";
import express from "express";
import cors from "cors";
import routes from "./routes/index.js";
import { initializeMongoPersistence } from "./services/persistence.service.js";

import { copyFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

if (process.env.YOUTUBE_COOKIES_FILE) {
  try {
    const tmpCookiesPath = path.join(os.tmpdir(), "youtube_cookies_writable.txt");
    copyFileSync(process.env.YOUTUBE_COOKIES_FILE, tmpCookiesPath);
    process.env.YOUTUBE_COOKIES_FILE = tmpCookiesPath;
    console.log(`🍪 Cookies file copied to writable tmp location: ${tmpCookiesPath}`);
  } catch (error) {
    console.error("⚠ Failed to copy cookies file to writable location:", error);
  }
}

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

app.use(cors());
app.use(express.json());

app.use("/api", routes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

void initializeMongoPersistence().catch((error) => {
  console.warn("⚠ Mongo persistence initialization failed:", error);
});

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log("   LLM Provider: OpenAI");
  console.log(
    `   Local Transcription Fallback: ${process.env.ENABLE_LOCAL_TRANSCRIBE === "true" ? "enabled" : "disabled"}`
  );
});
