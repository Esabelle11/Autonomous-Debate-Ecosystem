import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  Handle,
  Position
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "../styles/DebateGraph.css";

const SPEAKER_STYLES = {
  Alex: {
    lane: 44,
    color: "#38bdf8",
    border: "rgba(56, 189, 248, 0.55)"
  },
  Marcus: {
    lane: 344,
    color: "#f59e0b",
    border: "rgba(245, 158, 11, 0.55)"
  },
  Sarah: {
    lane: 644,
    color: "#f472b6",
    border: "rgba(244, 114, 182, 0.55)"
  }
};

const SEMANTIC_EDGE_STYLES = {
  support: {
    stroke: "#22c55e",
    background: "rgba(34, 197, 94, 0.16)"
  },
  attack: {
    stroke: "#ef4444",
    background: "rgba(239, 68, 68, 0.16)"
  },
  evidence: {
    stroke: "#a78bfa",
    background: "rgba(167, 139, 250, 0.16)"
  },
  concession: {
    stroke: "#D1B466",
    background: "rgba(197, 143, 26, 0.16)"
  },
  sameTheme: {
    stroke: "#216DDE",
    background: "rgba(67, 76, 180, 0.16)"
  },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function summariseText(value, limit = 160) {
  if (!value) {
    return "";
  }

  return value.length > limit
    ? `${value.slice(0, limit).trim()}...`
    : value;
}

function ArgumentNode({ data }) {
  return (
    <div
      className={`argument-node ${data.isActive ? "active" : ""}`}
      style={{
        "--speaker-color": data.color,
        "--speaker-border": data.border,
        position: "relative" // Ensures absolute handles align correctly inside the card
      }}
    >
      {/* 
        Incoming lines connect to the Left (Target), 
        Outgoing lines depart from the Right (Source)
      */}
      {/* 🔴 RED VIRAL DOT: Renders if data.viral is true */}
      {data.viral ? (
        <span 
          style={{
            position: "absolute",
            top: "-6px",
            right: "-6px",
            width: "12px",
            height: "12px",
            backgroundColor: "#ef4444", // Solid red color
            borderRadius: "50%",
            zIndex: 30, // Keeps it sitting above the node borders and text
            boxShadow: "0 0 8px rgba(239, 68, 68, 0.6)" // Adds a slight glowing effect
          }}
          title="Viral Claim" // Tooltip hover text
        />
      ) : null}
      <Handle type="target" position={Position.Left} style={{ background: "rgba(148, 163, 184, 0.5)" }} />
      <Handle type="source" position={Position.Right} style={{ background: "rgba(148, 163, 184, 0.5)" }} />

      <div className="argument-node__top">
        <span className="argument-node__speaker">{data.speaker}</span>
        <span className="argument-node__phase">{data.phase}</span>
      </div>

      <p className="argument-node__claim">{data.claim}</p>

      <p className="argument-node__text">{data.text}</p>

      <div className="argument-node__metrics">
        <span>Turn {data.turn + 1}</span>
        <span>Strength {data.strength}</span>
        <span>Influence {data.influence}</span>
        {/* {data.viral && <span style={{ color: "#ef4444", fontWeight: "bold" }}>🔥 Viral</span>} */}
      </div>
    </div>
  );
}

const nodeTypes = {
  argumentNode: ArgumentNode
};

export default function DebateGraph({ graph, currentSpeaker }) {
  if (!graph?.nodes?.length) {
    return null;
  }

  const nodes = graph.nodes.map((node) => {
    const style = SPEAKER_STYLES[node.speaker] || SPEAKER_STYLES.Marcus;
    const primaryClaim = node.claims?.[0] || node.text;

    // position X
    const n_shift_start = node.phaseId === 3 
    ? 2
    : node.phaseId === 4 
      ? 3
      : 0;
    const phase_start_pos = (n_shift_start+node.phaseId) * 400;
    const conditionSumation = (node.phaseId * node.phaseTurn > 1) ? 1 : 0;
    const horizontalShift = Math.floor((conditionSumation +node.phaseTurn) / 2) * 400;

    return {
      id: node.id,
      type: "argumentNode",
      position: {
        x: phase_start_pos + horizontalShift,
        y: style.lane
      },
      draggable: false,
      selectable: true,
      data: {
        speaker: node.speaker,
        phase: node.phase,
        claim: summariseText(primaryClaim, 110),
        text: summariseText(node.text, 180),
        turn: node.turn,
        strength: clamp(node.metrics?.strength ?? 0, 0, 10),
        influence: Math.round(node.analytics?.influence ?? 0),
        viral: node.metrics?.viral ?? false,
        color: style.color,
        border: style.border,
        isActive: currentSpeaker === node.speaker
      }
    };
  });

  const replyEdges = (graph.edges || []).map((edge, index) => ({
    id: `reply-${index}-${edge.from}-${edge.to}`,
    source: edge.from,
    target: edge.to,
    type: "smoothstep", // Keep replies rigid and right-angled
    animated: false,
    label: "reply",
    labelStyle: {
      fill: "#9ca3af",
      fontSize: 11,
      fontWeight: 600
    },
    labelBgStyle: {
      fill: "rgba(15, 23, 42, 0.92)",
      fillOpacity: 1,
      rx: 999,
      ry: 999
    },
    style: {
      stroke: "rgba(148, 163, 184, 0.45)",
      strokeWidth: 2
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: "rgba(148, 163, 184, 0.65)"
    },
    zIndex: 1 // Baseline edge depth
  }));

  const semanticEdges = (graph.semanticEdges || []).map((edge, index) => {
    const edgeStyle = SEMANTIC_EDGE_STYLES[edge.type] || SEMANTIC_EDGE_STYLES.evidence;
    const label = `${edge.type} ${Math.round((edge.confidence || 0) * 100)}%`;

    return {
      id: `semantic-${index}-${edge.from}-${edge.to}`,
      source: edge.from,
      target: edge.to,
      type: "default", 
      animated: true,
      label,
      labelStyle: {
        fill: "#e2e8f0",
        fontSize: 20,
        fontWeight: 700,
        textTransform: "capitalize"
      },
      labelBgStyle: {
        fill: edgeStyle.background,
        fillOpacity: 0.7,
        rx: 999,
        ry: 999
      },
      style: {
        stroke: edgeStyle.stroke,
        strokeWidth: 2.5,
        strokeDasharray: "7 5"
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edgeStyle.stroke
      },
      zIndex: 2      // Give semantic links a higher layout stack priority so they crossover on top
    };
  });

  const themes = (graph.themes || []).slice(0, 4);

  return (
    <section className="debate-graph-section">
      <div className="debate-graph__header">
        <div>
          <p className="debate-graph__eyebrow">Argument Map</p>
          <h3>How the debate unfolds</h3>
          <p className="debate-graph__description">
            Follow the reply chain across turns, then look for support, evidence,
            and attack links between claims.
          </p>
        </div>

        <div className="debate-graph__stats">
          <div className="debate-graph__stat">
            <strong>{graph.nodes.length}</strong>
            <span>Claims</span>
          </div>
          <div className="debate-graph__stat">
            <strong>{(graph.edges || []).length}</strong>
            <span>Replies</span>
          </div>
          <div className="debate-graph__stat">
            <strong>{(graph.semanticEdges || []).length}</strong>
            <span>Semantic links</span>
          </div>
        </div>
      </div>

      {/* {themes.length > 0 ? (
        <div className="debate-graph__themes">
          {themes.map((theme) => (
            <div key={theme.id} className="debate-graph__theme-pill">
              {summariseText(theme.label, 72)}
            </div>
          ))}
        </div>
      ) : null} */}

      <div className="debate-graph__legend">
        {/* <span><i className="speaker-dot alex" />Alex</span>
        <span><i className="speaker-dot marcus" />Marcus</span>
        <span><i className="speaker-dot sarah" />Sarah</span> */}
        <span><i className="speaker-dot viral" />Viral</span>
        <span><i className="edge-swatch reply" />Reply chain</span>
        <span><i className="edge-swatch support" />Support / attack / evidence</span>
      </div>

      <div className="debate-graph__canvas">
        <ReactFlow
          nodes={nodes}
          edges={[...replyEdges, ...semanticEdges]}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.14 }}
          minZoom={0.45}
          maxZoom={1.6}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
        >
          <Background color="rgba(148, 163, 184, 0.15)" gap={24} size={1} />
          <MiniMap
            pannable
            zoomable
            nodeStrokeWidth={3}
            maskColor="rgba(2, 6, 23, 0.72)"
            style={{
              background: "rgba(15, 23, 42, 0.9)",
              border: "1px solid rgba(148, 163, 184, 0.18)"
            }}
          />
          <Controls
            showInteractive={false}
            style={{
              background: "rgba(15, 23, 42, 0.9)",
              border: "1px solid rgba(148, 163, 184, 0.18)"
            }}
          />
        </ReactFlow>
      </div>
    </section>
  );
}