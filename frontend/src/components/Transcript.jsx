import "../styles/Transcript.css";

export default function Transcript({
    transcript,
    speaker
  }) {
    if (!transcript) {
      return null;
    }
  
    return (
      <section className="transcript">
        <div className="transcript-header">
          <div>
            <p className="transcript-eyebrow">Debate Transcript</p>
            {/* <h2>Line-by-line exchange</h2> */}
          </div>
        </div>
  
        {transcript.map(
          (line, index) => {
            const active =
              line.speaker === speaker;
  
            return (
              <div
                key={index}
                className={
                  active
                    ? "transcript-line active"
                    : "transcript-line"
                }
              >
                <div className="transcript-line-header">
                  <strong>
                    {line.speaker}
                  </strong>

                  {line.phase ? (
                    <span className="transcript-phase">
                      {line.phase}
                    </span>
                  ) : null}
                </div>
  
                <p>
                  {line.text}
                </p>
              </div>
            );
          }
        )}
      </section>
    );
  }