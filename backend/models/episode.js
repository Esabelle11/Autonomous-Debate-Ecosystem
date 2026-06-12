import { randomUUID } from "crypto";

export function createEpisode({
  topic,
  summary = "",
  audioUrl = "",
  duration = 0,
  transcript = [],
  timeline = []
}) {
  console.log("in models/episode")
  return {
    id: randomUUID(),

    date: new Date().toISOString(),

    topic,

    summary,

    audioUrl,

    duration,

    transcript,

    timeline
  };
}


// [
//     {
//       "id": "123456",
//       "date": "2026-06-10T12:00:00.000Z",
//       "topic": "AI replaces software engineering managers.",
//       "summary": "Alex and Sarah debate AI management.",
//       "audioUrl": "/audio/123456.mp3",
//       "duration": 180,
//       "transcript": [],
//       "timeline": []
//     }
//   ]