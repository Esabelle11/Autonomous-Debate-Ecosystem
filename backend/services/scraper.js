import axios from "axios";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openRouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY
});

export async function fetchTrendingTopic() {
  try {
    const res = await axios.get(
      "https://newsapi.org/v2/top-headlines",
      {
        params: {
          category: "technology",
          language: "en",
          pageSize: 5,
          apiKey: process.env.NEWS_API_KEY
        }
      }
    );

    const articles = res.data.articles || [];
    console.log("articles: ", articles)

    if (articles.length === 0) {
      return "AI systems are quietly replacing junior developers worldwide.";
    }

    const pick =
      articles[Math.floor(Math.random() * articles.length)];

    const raw = `${pick.title}. ${pick.description}`;
    console.log("raw: ", raw)

    const ai = await openRouter.chat.completions.create({
      model: "google/gemma-4-31b-it:free",
      messages: [
        {
          role: "system",
          content:
            "Turn news into ONE dramatic tech debate topic sentence. No extras."
        },
        {
          role: "user",
          content: raw
        }
      ]
    });
    

    return ai.choices[0].message.content.trim();
  } catch (err) {
    console.log("scraper fallback:", err.message);

    return "Big tech companies quietly test AI systems that replace entire product teams.";
  }
}