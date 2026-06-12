import dotenv from "dotenv";

dotenv.config();

import { buildEpisodeAudio } from "../services/audio.js";
import {
  loadEpisodes,
  saveEpisodes
} from "../services/storage.js";

async function run() {
  const episodes = await loadEpisodes();

  if (episodes.length === 0) {
    console.log("No episodes to process.");
    return;
  }

  for (const episode of episodes) {
    if (episode.audioUrl) {
      console.log("Skipping (already has audio):", episode.topic);
      continue;
    }

    if (!episode.transcript?.length) {
      console.log("Skipping (no transcript):", episode.topic);
      continue;
    }

    console.log("🎙 Generating audio for:", episode.topic);

    const audio = await buildEpisodeAudio(
      episode.id,
      episode.transcript
    );

    episode.audioUrl = audio.audioUrl;
    episode.duration = audio.duration;
    episode.timeline = audio.timeline;
  }

  await saveEpisodes(episodes);

  console.log("✅ Done.");
}

run();
