
import "../styles/EpisodeList.css";

export default function EpisodeList({episodes,onSelect}) {
  if (!episodes.length) {
    return (
      <div className="episode-list">

        <h2>Episodes</h2>

        <p>
          No episodes available.
        </p>

      </div>
    );
  }

  return (
    <div className="episode-list">

      <h2>
        📚 Recent Episodes
      </h2>

      {episodes.map((ep) => (
        <div key={ep.id} className="episode-card" onClick={() => onSelect(ep)}>
          <h3>
            {ep.topic}
          </h3>

          <small>
            {new Date(ep.date).toLocaleString()}
          </small>

          {/* <p>
            {ep.summary}
          </p> */}

        </div>
      ))}

    </div>
  );
}