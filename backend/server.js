import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import episodeRouter from "./routes/episodes.js";

dotenv.config();

const __dirname = path.dirname(
  fileURLToPath(import.meta.url)
);

const app = express();

const PORT = process.env.PORT || 3000;
const AUDIO_FOLDER =
  process.env.AUDIO_FOLDER ||
  path.join(__dirname, "audio");

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*"
  })
);

app.use(express.json());

app.use(
  "/audio",
  express.static(AUDIO_FOLDER)
);

app.get("/", (req, res) => {
  res.json({
    project: "Infinite Podcaster",
    version: "2.0",
    status: "running"
  });
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    timestamp: new Date().toISOString()
  });
});

app.use("/episodes", episodeRouter);

app.listen(PORT, () => {
  console.log("");
  console.log("==========================");
  console.log("📻 Infinite Podcaster");
  console.log("==========================");
  console.log(`🚀 Running on port ${PORT}`);
  console.log("");
});

// GET /
// GET /health
// GET /episodes
// GET /episodes/latest
// POST /generate