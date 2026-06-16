import fs from "fs/promises";
import path from "path";

import { speakLine } from "./tts.js";
// import { buildTimeline } from "./timeline.js";

const AUDIO_FOLDER =
  process.env.AUDIO_FOLDER || "./audio";

export async function buildEpisodeAudio(
  episodeId,
  transcript
) {
  if (!transcript?.length) {
    return { audioUrl: "", duration: 0, timeline: [] };
  }

  await fs.mkdir(AUDIO_FOLDER, { recursive: true });

  const chunks = [];
  const timeline = [];

  let currentTime=0;


  for (const line of transcript) {
    const audio = await speakLine(
      line.speaker,
      line.text
    );

    if (audio) {
      chunks.push(audio);
    }

    timeline.push({
      speaker:line.speaker,
      start:currentTime,
      end:currentTime+audio.duration,
      duration:audio.duration
    });

    currentTime+=audio.duration;
  }

  if (chunks.length === 0) {
    return { audioUrl: "", duration: 0, timeline: [] };
  }

  const combined = Buffer.concat(chunks);
  const filename = `${episodeId}.mp3`;
  const filePath = path.join(AUDIO_FOLDER, filename);

  await fs.writeFile(filePath, combined);

  // const timeline = buildTimeline(transcript);
  const duration =timeline.length > 0? timeline[timeline.length - 1].end: 0;

  return {
    audioUrl: `/audio/${filename}`,
    duration,
    timeline
  };
}
