import { useEffect, useState } from "react";


import './styles/App.css'

import {
  getEpisodes,
  getLatestEpisode
} from "./api";

import EpisodeList from "./components/EpisodeList";
import PodcastPlayer from "./components/PodcastPlayer";

export default function App() {
  const [episodes, setEpisodes] = useState([]);
  const [currentEpisode,setCurrentEpisode] =useState(null);
  const [loading,setLoading] =useState(true);
  const [error,setError] =useState("");

  async function loadData() {
    try {
      setLoading(true);

      const list =
        await getEpisodes();

      setEpisodes(list);

      if (list.length > 0) {
        const latest =
          await getLatestEpisode();

        setCurrentEpisode(latest);
      }
    } catch (err) {
      console.log(err);

      setError(
        "Cannot connect to backend."
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function chooseEpisode(ep) {
    setCurrentEpisode(ep);
  }

  if (loading) {
    return (
      <div className="app-container">
        <h1>
          📻 Infinite Podcaster
        </h1>

        <p>
          Loading today's debate...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container">
        <h1>
          📻 Infinite Podcaster
        </h1>

        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="app-container">

      <header>

        <h1>
          📻 Infinite Podcaster
        </h1>

        <p>
          Daily AI Debate Network
        </p>

      </header>

      <main>

        <EpisodeList
          episodes={episodes}
          onSelect={chooseEpisode}
        />

        <PodcastPlayer
          episode={currentEpisode}
        />

      </main>

    </div>
  );
}