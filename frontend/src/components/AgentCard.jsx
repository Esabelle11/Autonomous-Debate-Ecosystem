import "../styles/AgentCard.css";

export default function AgentCard({
    name,
    role,
    identity,
    active
  }) {
    const img =
      `/avatar-${identity.toLowerCase()}.png`;
  
    return (
      <div
        className={
          active
            ? "agent-card active"
            : "agent-card"
        }
      >
  
        <img
          src={img}
          alt={name}
          onError={(e) => {
            e.target.src =
              "https://api.dicebear.com/7.x/bottts/svg?seed=" +
              name;
          }}
        />
  
        <h3>
          {name}
        </h3>
  
        <p>
          {role}
        </p>
  
      </div>
    );
  }