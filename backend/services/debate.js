import OpenAI from "openai";
import dotenv from "dotenv";
import { system,emceePromptStyle } from "../config/agent_config.js";
import { createState, updateHeat, updateStagnation, updateMemory} from "../helper/debate_state.js";
import { generateDebatePackage, director, callAgent} from "../helper/debate_director.js";
import { createNode, linkNode, scoreNode, detectViralNodes} from "../helper/argument_graph.js";

dotenv.config();

// =========================
// MAIN ENGINE
// =========================
export async function generateDebate(topic, background) {
  const state = createState(topic, background);
  
  state.debatePackage= await generateDebatePackage(topic, background);

  while (true) {
    const decision = director(state);
    // console.log("decision: ",decision)

    const result = await callAgent(decision, state);

    const node = createNode({
      speaker: result.speaker.name,
      text: result.speech,
      turn: state.turn
    });

    linkNode(state, node,decision.speaker);
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