import axios from "axios";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openRouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY
});

const intensityProfile = {
  philosophical: { heat: 4, chaos: 3 },
  controversy: { heat: 7, chaos: 6 },
  viral: { heat: 5, chaos: 9 },
  emotional: { heat: 9, chaos: 8 }
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* =========================
   FETCH NEWS
========================= */
async function fetchArticles() {
  const res = await axios.get(
    "https://newsapi.org/v2/top-headlines",
    {
      params: {
        language: "en",
        pageSize: 3,
        apiKey: process.env.NEWS_API_KEY
      }
    }
  );

  return (res.data.articles || []).filter(
    a => a?.title && a?.description
  );
}

/* =========================
   FACT EXTRACTION
========================= */
async function extractFacts(signal) {
  const res = await openRouter.chat.completions.create({
    model: "openai/gpt-oss-120b:free",
    messages: [
      {
        role: "system",
        content: `
You are a strict news fact extractor.

Return STRICT JSON ONLY:
{
  "facts": ["..."],
  "entities": ["..."],
  "themes": ["..."]
}

RULES:
- ONLY extract facts explicitly present in SIGNAL
- DO NOT infer public reaction
- DO NOT add opinions
- DO NOT add consequences
- DO NOT add "debate", "controversy", "critics", "supporters"
- If unsure, omit
`
      },
      {
        role: "user",
        content: `SIGNAL:\n${signal}`
      }
    ]
  });

  return JSON.parse(res.choices[0].message.content);
}

/* =========================
  DEBATE GENERATION
========================= */
async function generateDebate(factsObj, mode, intensity) {
  const res = await openRouter.chat.completions.create({
    model: "openai/gpt-oss-120b:free",
    messages: [
      {
        role: "system",
        content: `
You are a debate podcast director.

You convert factual news input into a structured debate topic for broadcast.

The topic must satisfy:
1. Groundedness: derived only from provided facts
2. Debate condition: must allow at least two reasonable opposing perspectives
3. Format: must be a single neutral question suitable for discussion

Return STRICT JSON ONLY:
{
  "topic": "...",
  "background": "...",
  "framing": "...",
  "emotion": number,
  "controversy": number
}

RULES:
BACKGROUND:
- 2–4 sentences
- ONLY uses facts
- NO opinions
- NO "public debate", "critics", "controversy", "raises questions"
- NO invented social reactions

TOPIC:
- Must be debatable
- Can extend beyond facts

FRAMING:
- neutral question

EMOTION must match intensity: ${intensity.heat}
`
      },
      {
        role: "user",
        content: `
MODE: ${mode}
FACTS: ${JSON.stringify(factsObj.facts)}
THEMES: ${JSON.stringify(factsObj.themes)}
INTENSITY: ${JSON.stringify(intensity)}
`
      }
    ]
  });

  return JSON.parse(res.choices[0].message.content);
}

/* =========================
   MAIN PIPELINE
========================= */
export async function fetchTrendingTopic(mode = "philosophical") {
  try {
    const intensity = intensityProfile[mode];

    console.log("📡 Fetching articles...");
    const articles = await fetchArticles();

    // console.log("articles: ",articles)

    if (!articles.length) {
      return {
        topic: "Is AI replacing human developers inevitable?",
        background: "AI systems are increasingly being used in software development workflows. Some companies report efficiency gains, while others express concern about job displacement. The adoption rate continues to rise across the industry.",
        emotion: 5,
        controversy: 6,
        framing: "Should AI replace human developers in most software roles?"
      };
    }

    const seed = pick(articles);

    const signal = {
      title: seed.title,
      description: seed.description,
      source: seed.source?.name,
      publishedAt: seed.publishedAt
    };

    console.log("signal: ",signal)

    /* STEP 1 */
    const factsObj = await extractFacts(JSON.stringify(signal));
    console.log("factsObj: ",factsObj)

    /* STEP 2 */
    const debate = await generateDebate(factsObj, mode, intensity);
    console.log("debate: ",debate)

    return {
      ...debate,
      debug: {
        signal,
        facts: factsObj
      }
    };

  } catch (err) {
    console.log("error:", err.message);

    return {
      topic: "Should AI systems replace entire product teams?",
      background: "AI tools are increasingly being integrated into software development workflows. Companies are experimenting with automation in coding, testing, and deployment. This trend is accelerating across the tech industry.",
      emotion: 6,
      controversy: 6,
      framing: "Should AI replace human product teams?",
      debug: null
    };
  }
}