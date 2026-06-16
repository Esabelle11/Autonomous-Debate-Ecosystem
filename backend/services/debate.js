import OpenAI from "openai";
import dotenv from "dotenv";
import { system, emceePromptStyle } from "../config/agent_config.js";

dotenv.config();

const openRouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY
});


// =========================
// STATE
// =========================
function createState(topic, background) {
  return {
    topic,
    background,
    turn: 0,

    heat: 0,
    stagnation: 0,

    lastSpeaker: null,

    memory: [],
    transcript: [],

    graph: {
      nodes: [],
      edges: [],
      claimClusters: {
        support: [],
        oppose: [],
        neutral: []
      }
    },

    lastNode: null
  };
}


// =========================
// NODE
// =========================
function extractClaims(text) {
  return text
    .split(/,|\.|;|but|however|although/i)
    .map(s => s.trim())
    .filter(s => s.length > 20)
    .slice(0, 3);
}
function createNode({ speaker, text, turn }) {
  return {
    id: `${speaker}_${turn}_${Date.now()}`,
    speaker,
    text,
    turn,

    // NEW ARGUMENT STRUCTURE
    claims: extractClaims(text),
    stance: null, // support | oppose | neutral
    relation: null, // reply | support | refute | extend
    targetNodes: [],

    repliesTo: null,
    contradicts: [],

    strength: 0,
    heat: 0,
    viral: false,
    type: "claim"
  };
}


// =========================
// GRAPH BUILDER
// =========================
function linkNode(state, node) {
  const last = state.lastNode;

  if (!last) {
    state.graph.nodes.push(node);
    state.lastNode = node;
    return;
  }

  node.repliesTo = last.id;

  // default reply edge
  state.graph.edges.push({
    from: last.id,
    to: node.id,
    type: "reply"
  });

  // semantic contradiction detection
  const isContradiction = detectContradiction(last.text, node.text);

  if (isContradiction) {
    node.relation = "refute";
    node.targetNodes.push(last.id);

    node.contradicts.push(last.id);

    state.graph.edges.push({
      from: node.id,
      to: last.id,
      type: "refute"
    });
  } else {
    node.relation = "extend";

    state.graph.edges.push({
      from: last.id,
      to: node.id,
      type: "extend"
    });
  }

  state.graph.nodes.push(node);
  state.lastNode = node;
}


// =========================
// CONTRADICTION DETECTOR
// =========================
function detectContradiction(a, b) {
  const A = a.toLowerCase();
  const B = b.toLowerCase();

  const signals = [
    ["should", "should not"],
    ["good", "bad"],
    ["benefit", "harm"],
    ["increase", "decrease"],
    ["support", "oppose"],
    ["necessary", "unnecessary"],
    ["effective", "ineffective"]
  ];

  return signals.some(([p, n]) =>
    (A.includes(p) && B.includes(n)) ||
    (A.includes(n) && B.includes(p))
  );
}


// =========================
// NODE SCORING
// =========================
function scoreNode(node) {
  let score = 0;

  if (node.text.length > 200) score += 2;
  if (node.relation === "refute") score += 3;
  if (node.claims.length > 1) score += 1;

  const signalWords = ["because", "therefore", "however", "thus"];
  if (signalWords.some(w => node.text.toLowerCase().includes(w))) {
    score += 2;
  }

  node.strength = Math.min(10, score);
}


// =========================
// VIRAL DETECTION
// =========================
function detectViralNodes(state, node) {
  const keywords = ["war", "crime", "illegal", "scandal", "corrupt", "collapse"];

  const text = node.text.toLowerCase();

  const heat = keywords.filter(k => text.includes(k)).length;

  node.heat = heat + state.heat;

  if (node.heat >= 2 || node.relation === "refute") {
    node.viral = true;
  }
}

// =========================
// HEAT SYSTEM
// =========================
function updateHeat(state, speech) {
  const keywords = ["war", "crime", "illegal", "corrupt", "death"];

  const score = keywords.filter(k =>
    speech.toLowerCase().includes(k)
  ).length;

  state.heat = Math.max(0, Math.min(10, state.heat * 0.8 + score));
}


// =========================
// STAGNATION
// =========================
function updateStagnation(state) {
  if (state.memory.length < 4) return;

  const recent = state.memory.slice(-4);
  const unique = new Set(recent);

  if (unique.size <= 2) state.stagnation++;
  else state.stagnation = Math.max(0, state.stagnation - 1);
}


// =========================
// MEMORY
// =========================
function updateMemory(state, result) {
  state.memory.push(`${result.speaker.name}: ${result.speech}`);

  state.transcript.push({
    speaker: result.speaker.name,
    text: result.speech
  });
}


// =========================
// LLM
// =========================
async function speak(model, messages) {
  const res = await openRouter.chat.completions.create({
    model,
    messages
  });

  return res.choices[0].message.content;
}


// =========================
// CONTEXT BUILDER
// =========================
function buildContext(state, speaker, task) {
  return [
    {
      role: "system",
      content: speaker.systemPrompt
    },
    {
      role: "system",
      content: `
TOPIC: ${state.topic}

BACKGROUND: ${state.background}

RECENT MEMORY:
${state.memory.join("\n")}

LAST SPEAKER: ${state.lastSpeaker?.name || "None"}
      `
    },
    {
      role: "user",
      content: task
    }
  ];
}


// =========================
// DIRECTOR (AGENT SCHEDULER)
// =========================
function director(state) {
  const intro = state.turn === 0;
  const end = state.turn > 12 || state.stagnation > 4;

  if (intro) {
    return {
      speaker: system.emcee,
      task: emceePromptStyle.opening
    };
  }

  if (end) {
    return {
      speaker: system.emcee,
      task: emceePromptStyle.closing
    };
  }

  // emcee interruption probability
  if (Math.random() < state.heat / 25) {
    return {
      speaker: system.emcee,
      task: emceePromptStyle.moderation
    };
  }

  return {
    speaker: pickDebater(state),
    task: "Respond directly to the last argument. Escalate logically. Avoid repetition."
  };
}


// =========================
// DEBATER PICKER
// =========================
function pickDebater(state) {
  const debaters = system.debaters;

  if (state.lastSpeaker?.name === system.emcee.name) {
    return debaters[Math.floor(Math.random() * debaters.length)];
  }

  return debaters.find(d => d.name !== state.lastSpeaker?.name);
}


// =========================
// AGENT CALL
// =========================
async function callAgent(decision, state) {
  const prompt = buildContext(state, decision.speaker, decision.task);

  const speech = await speak(decision.speaker.model, prompt);

  return {
    speaker: decision.speaker,
    speech
  };
}


// =========================
// MAIN ENGINE
// =========================
export async function generateDebate(topic, background) {
  const state = createState(topic, background);

  while (true) {
    const decision = director(state);

    const result = await callAgent(decision, state);

    const node = createNode({
      speaker: result.speaker.name,
      text: result.speech,
      turn: state.turn
    });

    linkNode(state, node);
    scoreNode(node);
    detectViralNodes(state, node);

    updateMemory(state, result);
    updateHeat(state, result.speech);
    updateStagnation(state);

    state.lastSpeaker = result.speaker;
    state.turn++;

    if (
      result.speaker.name === "Marcus" &&
      decision.task === emceePromptStyle.closing
    ) {
      break;
    }
  }

  return {
    transcript: state.transcript,
    graph: state.graph
  };
}