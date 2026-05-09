import "dotenv/config";
import express from "express";
import cors from "cors";
import routes from "./routes/index.js";
import { initializeMongoPersistence } from "./services/persistence.service.js";

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
