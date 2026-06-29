import { useState, useRef, useEffect } from "react";
import "../styles/PodcastPlayer.css";
import AgentCard from "./AgentCard";
import Transcript from "./Transcript";
import Visualizer from "./Visualizer";
import DebateGraph from "./DebateGraph";

const API = import.meta.env.VITE_API || "http://localhost:3000";

function resolveAudioUrl(url) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${API}${url}`;
}

export default function PodcastPlayer({ episode }) {
  const audioRef = useRef(null);
  const mediaSourceRef = useRef(null);
  const sourceBufferRef = useRef(null);

  const [currentSpeaker, setCurrentSpeaker] = useState("");
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    if (!episode?.audioUrl) return;

    const audio = audioRef.current;
    if (!audio) return;

    const mediaSource = new MediaSource();
    mediaSourceRef.current = mediaSource;

    audio.src = URL.createObjectURL(mediaSource);

    let abortController = new AbortController();

    mediaSource.addEventListener("sourceopen", async () => {
      // MP3 mime (important)
      const mime = 'audio/mpeg';

      const sourceBuffer = mediaSource.addSourceBuffer(mime);
      sourceBufferRef.current = sourceBuffer;

      const url = resolveAudioUrl(episode.audioUrl);

      try {
        const response = await fetch(url, {
          signal: abortController.signal
        });

        const reader = response.body.getReader();

        const pump = async () => {
          const { done, value } = await reader.read();

          if (done) {
            if (!mediaSource.readyState === "closed") {
              mediaSource.endOfStream();
            }
            return;
          }

          await new Promise(resolve => {
            const append = () => {
              try {
                if (!sourceBuffer.updating) {
                  sourceBuffer.appendBuffer(value);
                  resolve();
                } else {
                  sourceBuffer.addEventListener("updateend", resolve, { once: true });
                }
              } catch (e) {
                console.error("Append error:", e);
                resolve();
              }
            };

            append();
          });

          return pump();
        };

        pump();
      } catch (err) {
        console.error("Stream error:", err);
      }
    });

    function update() {
      const t = audio.currentTime;
      setCurrentTime(t);

      if (episode.timeline) {
        const active = episode.timeline.find(
          x => t >= x.start && t <= x.end
        );

        if (active) {
          setCurrentSpeaker(active.speaker);
        }
      }
    }

    audio.addEventListener("timeupdate", update);

    return () => {
      abortController.abort();
      audio.removeEventListener("timeupdate", update);

      if (mediaSourceRef.current) {
        try {
          mediaSourceRef.current.endOfStream();
        } catch {}
      }
    };
  }, [episode]);

  if (!episode) {
    return <div>Select an episode.</div>;
  }

  return (
    <div className="podcast-player">
      <div className="podcast-player__hero">
        <p className="podcast-player__eyebrow">Current Episode</p>
        <h2>🎙 {episode.topic}</h2>

        <p className="podcast-player__summary">
          {episode.summary}
        </p>
      </div>

      {episode.audioUrl ? (
        <audio
          controls
          ref={audioRef}
          className="podcast-player__audio"
        />
      ) : (
        <p className="no-audio">
          No audio for this episode yet. Run{" "}
          <code>npm run generate:audio</code> in the backend folder.
        </p>
      )}

      <Visualizer currentTime={currentTime} />

      <div className="host-panel">
        <AgentCard name="Alex" identity="alex" role="Optimist" active={currentSpeaker === "Alex"} />
        <AgentCard name="Marcus" identity="marcus" role="Host" active={currentSpeaker === "Marcus"} />
        <AgentCard name="Sarah" identity="sarah" role="Skeptic" active={currentSpeaker === "Sarah"} />
      </div>

      <div className="podcast-player__insights">
        <Transcript transcript={episode.transcript} speaker={currentSpeaker} />
        <DebateGraph graph={episode.graph} currentSpeaker={currentSpeaker} />
      </div>
    </div>
  );
}