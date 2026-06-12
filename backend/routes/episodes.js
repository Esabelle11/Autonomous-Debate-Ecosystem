import express from "express";

import { createEpisode } from "../models/episode.js";
import {
  loadEpisodes,
  saveEpisodes,
  limitEpisodes
} from "../services/storage.js";

const router = express.Router();

const MAX_EPISODES =
  Number(process.env.MAX_EPISODES) || 7;

/*
GET /episodes

Returns every episode.
*/

router.get("/", async (req, res) => {
  try {
    console.log("in episodes")
    const episodes = await loadEpisodes();

    episodes.sort(
      (a, b) =>
        new Date(b.date) - new Date(a.date)
    );

    res.json(episodes);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Cannot load episodes."
    });
  }
});

/*
GET /episodes/latest
*/

router.get("/latest", async (req, res) => {
  try {
    console.log("in latest episodes")
    const episodes = await loadEpisodes();

    if (episodes.length === 0) {
      return res.json({
        message: "No episodes yet."
      });
    }

    episodes.sort(
      (a, b) =>
        new Date(b.date) - new Date(a.date)
    );

    res.json(episodes[0]);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Cannot load latest episode."
    });
  }
});

/*
GET /episodes/:id
*/

router.get("/:id", async (req, res) => {
  try {
    console.log("in id episodes")
    const episodes = await loadEpisodes();

    const episode = episodes.find(
      (x) => x.id === req.params.id
    );

    if (!episode) {
      return res.status(404).json({
        error: "Episode not found."
      });
    }

    res.json(episode);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Cannot load episode."
    });
  }
});

/*
POST /episodes

Temporary manual endpoint.
Later this route will call:

scraper
↓
debate
↓
tts
↓
timeline
↓
storage
*/

router.post("/", async (req, res) => {
  try {
    console.log("in post episodes")
    const episodes = await loadEpisodes();
    console.log('in post episodes req: ${req}')
    console.log('in post episodes res: ${res}')
    
    const episode = createEpisode({
      topic:
        req.body.topic ||
        "Sample AI Debate",

      summary:
        req.body.summary ||
        "Demo episode.",

      audioUrl:
        req.body.audioUrl || "",

      duration:
        req.body.duration || 0,

      transcript:
        req.body.transcript || [],

      timeline:
        req.body.timeline || []
    });

    episodes.push(episode);

    const trimmed = limitEpisodes(
      episodes,
      MAX_EPISODES
    );

    await saveEpisodes(trimmed);

    res.json(episode);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Cannot create episode."
    });
  }
});

export default router;
