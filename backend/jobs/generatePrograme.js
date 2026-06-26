import dotenv from "dotenv";
dotenv.config();

import { selectBestTopic } from "../services/topic_retrieve.js";
import { generateDebate } from "../services/debate.js";
import { buildEpisodeAudio } from "../services/audio.js";
import {loadEpisodes,saveEpisodes,limitEpisodes} from "../services/storage.js";
import { createEpisode } from "../models/episode.js";

async function run() {
  console.log("📻 Generating daily episode...");

  const {title, topic, background, framing, mode} = await selectBestTopic();
  console.log("Topic:", topic);
  console.log("background:", background);

  const { transcript, debatePackage, graph } = await generateDebate(topic,background,framing);
  // console.log("transscripts:")
  // console.log(transcript)
  // console.log("graph:", graph);

  const episode = createEpisode({
    topic,
    summary:background,
    transcript,
    debatePackage,
    graph,
    timeline: [],
    audioUrl: ""
  });

  // console.log("🎙 Generating audio (this may take a minute)...");
  // const audio = await buildEpisodeAudio(episode.id,transcript);
  // episode.audioUrl = audio.audioUrl;
  // episode.duration = audio.duration;
  // episode.timeline = audio.timeline;

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
