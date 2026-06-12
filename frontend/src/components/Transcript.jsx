import "../styles/Transcript.css";

export default function Transcript({
    transcript,
    speaker
  }) {
    if (!transcript) {
      return null;
    }
  
    return (
      <div
        style={{
          marginTop: "20px",
          padding: "15px",
          border: "1px solid #444",
          borderRadius: "10px",
          background: "#222",
          maxHeight: "400px",
          overflowY: "auto"
        }}
      >
        <h2>
          📝 Transcript
        </h2>
  
        {transcript.map(
          (line, index) => {
            const active =
              line.speaker === speaker;
  
            return (
              <div
                key={index}
                style={{
                  marginBottom: "15px",
                  padding: "10px",
                  borderRadius: "8px",
                  background: active
                    ? "#333"
                    : "transparent",
                  border: active
                    ? "2px solid gold"
                    : "1px solid #555"
                }}
              >
                <strong>
                  {line.speaker}
                </strong>
  
                <p>
                  {line.text}
                </p>
              </div>
            );
          }
        )}
      </div>
    );
  }