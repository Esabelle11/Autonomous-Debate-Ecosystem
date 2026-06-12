import "../styles/Visualizer.css";
import { useEffect, useState } from "react";

export default function Visualizer({ currentTime }) {
  const [bars, setBars] = useState(
    Array(20).fill(20)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const next = [];

      for (let i = 0; i < 20; i++) {
        next.push(
          10 + Math.random() * 50
        );
      }

      setBars(next);
    }, 150);

    return () => clearInterval(interval);
  }, [currentTime]);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
        gap: "4px",
        margin: "20px 0",
        height: "80px"
      }}
    >
      {bars.map((h, i) => (
        <div
          key={i}
          style={{
            width: "8px",
            height: `${h}px`,
            background: "#4cafef",
            borderRadius: "4px",
            transition: "0.12s"
          }}
        />
      ))}
    </div>
  );
}