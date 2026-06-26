import axios from "axios";
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const openRouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY
});

/* =========================
   SAVE HELPERS (JSON + CSV)
========================= */
function saveResearchOutput(data) {
  const dir = path.resolve("data");

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const timestamp = Date.now();

  const jsonFilePath = path.join(dir, `research-${timestamp}.json`);
  fs.writeFileSync(jsonFilePath, JSON.stringify(data, null, 2));

  const rows = data.dataset.map(d => ({
    title: d.signal.title,
    description: d.signal.description,
    source: d.signal.source,
    mode: d.mode,
    themes: (d.facts.themes || []).join("; "),
    entities: (d.facts.entities || []).join("; "),
    factsCount: (d.facts.facts || []).join("; "),
    topic: d.debate.topic,
    background: d.debate.background,
    framing_debate: d.debate.framing,
    faithfulness: d.evaluation.faithfulness,
    relevance: d.evaluation.relevance,
    controversy: d.evaluation.controversy,
    framing: d.evaluation.framing,
    coherence: d.evaluation.coherence,
    overall: d.evaluation.overall,
    average: d.average_eval,
    selected: 0,

  }));

  const headers = Object.keys(rows[0] || {});

  const csv = [
    headers.join(","),
    ...rows.map(r =>
      headers
        .map(h =>
          `"${(r[h] ?? "").toString().replace(/"/g, '""')}"`
        )
        .join(",")
    )
  ].join("\n");

  const csvFilePath = path.join(dir, `research-${timestamp}.csv`);
  fs.writeFileSync(csvFilePath, csv);

  return { jsonFilePath, csvFilePath };
}

/* =========================
   INTENSITY PROFILES
========================= */
const intensityProfile = {
  philosophical: { heat: 4, chaos: 3 },
  controversy: { heat: 7, chaos: 6 },
  viral: { heat: 5, chaos: 9 },
  emotional: { heat: 9, chaos: 8 }
};

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
          - DO NOT infer reactions
          - DO NOT add opinions
          - DO NOT add consequences
          - DO NOT add debate framing
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
   FETCH NEWS
========================= */
async function fetchArticles() {
  const res = await axios.get(
    "https://newsapi.org/v2/top-headlines",
    {
      params: {
        language: "en",
        pageSize: 5,
        apiKey: process.env.NEWS_API_KEY
      }
    }
  );

  return (res.data.articles || []).filter(
    a => a?.title && a?.description
  );
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
   EVALUATION DEBATE
========================= */
async function evaluateDebateTopic(signal, facts, debate) {
  const res = await openRouter.chat.completions.create({
    model: "openai/gpt-oss-120b:free",
    messages: [
      {
        role: "system",
        content: `
          You are a strict AI debate quality evaluator.

          You MUST score each metric from 0–10.

          Scoring rubric:

          1. faithfulness (0–10)
          - 10: All claims strictly supported by FACTS
          - 7: Mostly grounded, minor interpretation
          - 4: Some unsupported assumptions
          - 0: Hallucinated or contradicts facts

          2. relevance (0–10)
          - 10: Debate directly derived from SIGNAL
          - 7: Closely related topic expansion
          - 4: Partially related
          - 0: Off-topic

          3. controversy (0–10)
          - 10: Strong opposing viewpoints clearly implied
          - 7: Moderate debate tension
          - 4: Weak disagreement potential
          - 0: Purely factual / non-debatable

          4. framing (0–10)
          - 10: Clear neutral question, balanced framing
          - 7: Mostly neutral with slight bias
          - 4: Slightly leading or unclear
          - 0: Biased or not a question

          5. coherence (0–10)
          - 10: Background logically supports topic perfectly
          - 7: Minor logical gaps
          - 4: Weak connection between facts and topic
          - 0: Disconnected or inconsistent

          overall (0–10)
          - weighted average of all above
          - penalize hallucination heavily

          Return STRICT JSON ONLY:
          {
            "faithfulness": number,
            "relevance": number,
            "controversy": number,
            "framing": number,
            "coherence": number,
            "overall": number
          }
        `
      },
      {
        role: "user",
        content: `
SIGNAL:
${JSON.stringify(signal)}

FACTS:
${JSON.stringify(facts)}

DEBATE:
${JSON.stringify(debate)}
`
      }
    ]
  });

  return JSON.parse(res.choices[0].message.content);
}

/* =========================
   Average Evaluation
========================= */
function averageEvaluation(evaluation) {
  const metrics = [
    evaluation.faithfulness,
    evaluation.relevance,
    evaluation.controversy,
    evaluation.framing,
    evaluation.coherence
  ];

  return metrics.reduce((a, b) => a + b, 0) / metrics.length;
}

// function averageEvaluation(evaluation) {
//   const values = Object.values(evaluation);
//   return values.reduce((a, b) => a + b, 0) / values.length;
// }
// function averageEvaluation(e) {
//   return (
//     e.faithfulness * 0.30 +
//     e.relevance    * 0.25 +
//     e.controversy  * 0.15 +
//     e.framing      * 0.15 +
//     e.coherence    * 0.15
//   );
// }

/* =========================
   MAIN PIPELINE
========================= */
export async function runResearchScraper() {
  try {
    console.log("📡 Fetching articles...");
    const articles = await fetchArticles();

    if (!articles.length) throw new Error("No articles found");

    console.log(`📰 Articles loaded: ${articles.length}`);

    const dataset = [];

    for (const article of articles) {
      try {
        const signal = {
          title: article.title,
          description: article.description,
          source: article.source?.name,
          publishedAt: article.publishedAt
        };

        console.log("⚙️ Processing:", signal.title);

        const factsObj = await extractFacts(JSON.stringify(signal));

        /* =========================
          SINGLE MODE PER ARTICLE 
        ========================= */
        for (const [mode, intensity] of Object.entries(intensityProfile)) {
          const debate = await generateDebate(factsObj, mode, intensity);

          const evaluation = await evaluateDebateTopic(signal, factsObj, debate);

          const average_eval = averageEvaluation(evaluation);

          dataset.push({
            signal,
            facts: factsObj,
            mode,
            intensity,
            debate,
            evaluation,
            average_eval
          });
        }

      } catch (err) {
        console.log(
          `⚠️ Skipping article: ${article.title}`
        );
        console.log(err.message);
        continue;
      }
    }

    const summary = {
      totalRecords: dataset.length,
      intensityProfile,
      themes: dataset.flatMap(d => d.facts.themes),
      entities: dataset.flatMap(d => d.facts.entities),
      generatedAt: new Date().toISOString()
    };

    const finalOutput = {
      summary,
      dataset
    };

    const { jsonFilePath, csvFilePath } = saveResearchOutput(finalOutput);

    console.log("JSON saved:", jsonFilePath);
    console.log("CSV saved:", csvFilePath);

    return {
      jsonFilePath,
      csvFilePath,
      summary
    };

  } catch (err) {
    console.log("❌ Error:", err.message);
    return null;
  }
}

/* =========================
   RUN
========================= */
runResearchScraper();