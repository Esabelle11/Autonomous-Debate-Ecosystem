import { system, emceePromptStyle } from "../config/agent_config.js";

// =========================
// STATE
// =========================
export function createState(topic, background) {
    return {
        topic,
        background,

        debatePackage: null,

        turn: 0,
        phase: "OPENING",
        phaseId: 0,
        phaseTurn: 0,

        heat: 0,
        stagnation: 0,

        lastSpeaker: null,
        last_speech: "",
        reply_to:[],

        memory: [],
        transcript: [],

        graph: {
          nodes: [],
          edges: [],
        },

        lastNode: null
    };
}

function updatePhase(state) {
  const nextPhase =
    state.turn < 1 ? "OPENING" :
    state.turn < 3 ? "BUILD" :
    state.turn < 8 ? "CLASH" :
    state.turn < 11 ? "CONSOLIDATION" :
    "CLOSING";

  if (state.phase !== nextPhase) {
    state.phase = nextPhase;
    state.phaseTurn = 0;
    state.phaseId++
  } else {
    state.phaseTurn++;
  }
}

const phaseTransitions = {
  BUILD:
    "PHASE TRANSITION: We have heard the initial positions. Let's explore the reasoning behind them.",

  CLASH:
    "PHASE TRANSITION: The core disagreement is now clear. Challenge the strongest point made by your opponent.",
  CONSOLIDATION:
    "PHASE TRANSITION: ask debaters to identify the strongest objection to your own argument and respond to it directly. Do not summarize or conclude your position.",
  
    CLOSING:
    "PHASE TRANSITION: Let's move to final remarks.ask debaters to summarize their case without introducing new arguments."
};


  
// =========================
// MEMORY
// =========================
export function updateMemory(state, result) {
    state.memory.push(`${result.speaker.name}: ${result.speech}`);
    
    state.last_speech= `${result.speech}`;
  
    state.transcript.push({
      speaker: result.speaker.name,
      text: result.speech,
      phase: state.phase,
    });
}
  


  
// =========================
// DEBATER PICKER
// =========================
function pickDebater(state) {
  const debaters = system.debaters;

  if (state.lastSpeaker?.name === system.emcee.name) {
    
    const speechText = state.last_speech || "";
    const cuedDebater = debaters.find(d => 
      speechText.toLowerCase().includes(d.name.toLowerCase())
    );
    if (cuedDebater) {
      return cuedDebater;
    }

    return debaters[Math.floor(Math.random() * debaters.length)];
  }

  return debaters.find(d => d.name !== state.lastSpeaker?.name);
}



function getNodesByPhase(state, phase) {
  return state.graph.nodes.filter(node => node.phase === phase);
}

function getLastNode(state) {
  return state.graph.nodes.at(-1);   // or nodes[nodes.length - 1]
}

function getLastNodes(state, count) {
  return state.graph.nodes.slice(-count);
}



export function director(state) {
  updatePhase(state);

  switch (state.phase) {

    // =========================
    // 1. OPENING
    // =========================
    case "OPENING": {
      if (state.turn === 0) {
        return {
          speaker: system.emcee,
          task: emceePromptStyle.opening
        };
      }

      return {
        speaker: pickDebater(state),
        task: ""
      };
    }

    // =========================
    // 2. BUILD PHASE
    // =========================
    case "BUILD": {
      state.reply_to = getNodesByPhase(state, "OPENING").map(node => node.id);

      return {
        speaker: pickDebater(state),
        task: ""
      };
    }

    // =========================
    // 3. CLASH PHASE
    // =========================
    case "CLASH": {
      state.reply_to = [getLastNode(state)?.id].filter(Boolean);

      if (state.phaseTurn === 0) {
        return {
          speaker: system.emcee,
          task: phaseTransitions[state.phase]
        };
      }

      return {
        speaker: pickDebater(state),
        task: ""
      };
    }

    // =========================
    // 4. CONSOLIDATION
    // =========================
    case "CONSOLIDATION": {
      
      if (state.phaseTurn === 0) {
        state.reply_to = [];
        return {
          speaker: system.emcee,
          task: phaseTransitions[state.phase]
        };
      }
      const firstConsolidation = getNodesByPhase(state, "CONSOLIDATION")[0];

      state.reply_to = firstConsolidation
        ? [firstConsolidation.id]
        : [];

      return {
        speaker: pickDebater(state),
        task: ""
      }
    }

    // =========================
    // 5. CLOSING
    // =========================
    case "CLOSING": {
      if (state.phaseTurn === 0) {
        state.reply_to = [];
        return {
          speaker: system.emcee,
          task: phaseTransitions[state.phase]
        };
      }

      if(state.phaseTurn < 3){
        const firstClosing = getNodesByPhase(state, "CLOSING")[0];
        state.reply_to = firstClosing
          ? [firstClosing.id]
          : [];
          
        return {
          speaker: pickDebater(state),
          task: ""
        };
      }
      state.reply_to = getLastNodes(state, 2).map(node => node.id);

      return {
        speaker: system.emcee,
        task: emceePromptStyle.closing
      };
    }
  }
}