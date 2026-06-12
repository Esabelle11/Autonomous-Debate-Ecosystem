import dotenv from "dotenv";
dotenv.config();

import { fetchTrendingTopic } from "../services/scraper.js";
import { generateDebate } from "../services/debate.js";
import { buildEpisodeAudio } from "../services/audio.js";
import {loadEpisodes,saveEpisodes,limitEpisodes} from "../services/storage.js";
import { createEpisode } from "../models/episode.js";

async function run() {
  console.log("📻 Generating daily episode...");

  const topic = await fetchTrendingTopic();
  console.log("Topic:", topic);

  const { transcript } = await generateDebate(topic);
  console.log("transscripts:")
  console.log(transcript)

  const episode = createEpisode({
    topic,
    summary: "Auto-generated AI debate episode",
    transcript,
    timeline: [],
    audioUrl: ""
  });

  console.log("🎙 Generating audio (this may take a minute)...");

  const audio = await buildEpisodeAudio(episode.id,transcript);

  episode.audioUrl = audio.audioUrl;
  episode.duration = audio.duration;
  episode.timeline = audio.timeline;

  const episodes = await loadEpisodes();

  episodes.push(episode);

  const trimmed = limitEpisodes(episodes,Number(process.env.MAX_EPISODES || 7));

  await saveEpisodes(trimmed);

  console.log("✅ Episode generated:", episode.topic);
  if (episode.audioUrl) {
    console.log("🔊 Audio:", episode.audioUrl);
  } else {
    console.log("⚠️  No audio generated (check TTS_AI_KEY)");
  }
}

run();
