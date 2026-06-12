
import {
  useState,
  useRef,
  useEffect
} from "react";
import "../styles/PodcastPlayer.css";
import AgentCard from "./AgentCard";
import Transcript from "./Transcript";
import Visualizer from "./Visualizer";

const API =
  import.meta.env.VITE_API ||
  "http://localhost:3000";

function resolveAudioUrl(url) {
  if (!url) return "";

  if (url.startsWith("http")) {
    return url;
  }

  return `${API}${url}`;
}

export default function PodcastPlayer({
  episode
}) {
  const audioRef =
    useRef(null);

  const [
    currentSpeaker,
    setCurrentSpeaker
  ] = useState("");

  const [
    currentTime,
    setCurrentTime
  ] = useState(0);

  useEffect(() => {
    if (!episode?.audioUrl) return;

    const audio =
      audioRef.current;

    if (!audio) return;

    function update() {
      const t =
        audio.currentTime;

      setCurrentTime(t);

      if (
        episode.timeline
      ) {
        const active =
          episode.timeline.find(
            x =>
              t >= x.start &&
              t <= x.end
          );

        if (active) {
          setCurrentSpeaker(
            active.speaker
          );
        }
      }
    }

    audio.addEventListener(
      "timeupdate",
      update
    );

    return () => {
      audio.removeEventListener(
        "timeupdate",
        update
      );
    };
  }, [episode]);

  if (!episode) {
    return (
      <div>

        Select an episode.

      </div>
    );
  }

  return (
    <div className="podcast-player">

      <h2>
        🎙 {episode.topic}
      </h2>

      <p>
        {episode.summary}
      </p>

      {episode.audioUrl ? (
        <audio
          controls
          ref={audioRef}
          src={resolveAudioUrl(episode.audioUrl)}
          style={{ width: "100%" }}
        />
      ) : (
        <p className="no-audio">
          No audio for this episode yet. Run{" "}
          <code>npm run generate:audio</code> in the backend folder.
        </p>
      )}

      <Visualizer
        currentTime={
          currentTime
        }
      />

      <div
        className="host-panel"
      >

        <AgentCard
          name="Alex"
          identity="alex"
          role="Optimist"
          active={
            currentSpeaker ===
            "Alex"
          }
        />

        <AgentCard
          name="Marcus"
          identity="marcus"
          role="Host"
          active={
            currentSpeaker ===
            "Marcus"
          }
        />

        <AgentCard
          name="Sarah"
          identity="sarah"
          role="Skeptic"
          active={
            currentSpeaker ===
            "Sarah"
          }
        />

      </div>

      <Transcript
        transcript={
          episode.transcript
        }
        speaker={
          currentSpeaker
        }
      />

    </div>
  );
}