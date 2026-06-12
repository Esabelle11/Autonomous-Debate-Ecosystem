import OpenAI from "openai";
import dotenv from "dotenv";
import { cleanText } from "../helper/clean_text.js";

dotenv.config();

const openRouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY
});


const system = {
  emcee: `
You are Marcus, a radio host.

Rules:
- Speak 1-2 sentences.
- Maximum 25 words.
- Never describe sounds or emotions.
- Never use markdown.
- Never narrate actions.
- Just speak naturally.
`,

  alex: `
You are Alex.

Personality:
- Tech optimist.
- Friendly and confident.

Rules:
- Maximum 2 sentences.
- Maximum 30 words.
- Reply conversationally.
- Don't write lists.
- Don't explain in detail.
- Don't use markdown.
- Don't introduce yourself.
`,

  sarah: `
You are Sarah.

Personality:
- Skeptical.
- Funny.
- Slightly sarcastic.

Rules:
- Maximum 2 sentences.
- Maximum 30 words.
- Directly attack Alex's last point.
- Don't use markdown.
- Don't narrate actions.
`
};

async function speak(model, messages) {
  const res = await openRouter.chat.completions.create({
    model,
    messages
  });

  return cleanText(res.choices[0].message.content);
}

export async function generateDebate(topic) {
  const timeline = [];
  const transcript = [];
  const history = [];


  const context = [
    {
      role: "system",
      content: "You are in a live radio debate."
    }
  ];
  history.push(...context);

  // INTRO (Marcus)
  const intro = await speak(
    "google/gemma-4-31b-it:free",
    [
      ...context,
      { role: "system", content: system.emcee },
      {
        role: "user",
        content: `Introduce topic: ${topic}`
      }
    ]
  );

  history.push({role:"assistant",content:`Marcus: ${intro}`});
  transcript.push({ speaker: "Marcus", text: intro });
  timeline.push({speaker: "Marcus",start: 0});

  let t = 5;

  for (let i = 0; i < 2; i++) {
    console.log(`i: ${i}`)
    const alex = await speak(
      "openai/gpt-oss-120b:free",
      [
        ...history,
        { role: "system", content: system.alex },
        { role: "user", content: topic }
      ]
    );

    console.log(`alex output : ${alex}`)
    history.push({role: "assistant",content: `Alex: ${alex}`});
    transcript.push({ speaker: "Alex", text: alex });
    timeline.push({ speaker: "Alex", start: t });
    t += 6;

    const sarah = await speak(
      "google/gemma-4-31b-it:free",
      [
        ...history,
        { role: "system", content: system.sarah },
        { role: "user", content: alex }
      ]
    );

    console.log(`sarah output : ${sarah}`)
    history.push({role: "assistant",content: `Sarah: ${sarah}`});
    transcript.push({ speaker: "Sarah", text: sarah });
    timeline.push({ speaker: "Sarah", start: t });
    t += 6;
  }

  return { transcript, timeline };
}