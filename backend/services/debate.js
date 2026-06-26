import dotenv from "dotenv";
import { emceePromptStyle } from "../config/agent_config.js";
import { createState, updateHeat, updateStagnation, updateMemory} from "../helper/debate_state.js";
import { generateDebatePackage, director, callAgent} from "./debate_director.js";
import { createNode, linkNode, scoreNode, detectViralNodes} from "../helper/argument_graph.js";
import { getEmbedding } from "../helper/embedding.js";
dotenv.config();

function stripGraph(graph) {
  return {
    nodes: graph.nodes.map(({ embedding, ...rest }) => rest),
    edges: graph.edges,
    claimClusters: graph.claimClusters
  };
}



// =========================
// MAIN ENGINE
// =========================
export async function generateDebate(topic, background) {
  const state = createState(topic, background);
  
  state.debatePackage= await generateDebatePackage(topic, background);
  console.log("[state.debatePackage] : ", state.debatePackage)
  while (true) {
    const decision = director(state);
    // console.log("decision: ",decision)

    const result = await callAgent(decision, state);

    const embedding = await getEmbedding(result.speech);

    const node = createNode({
        speaker: result.speaker.name,
        text: result.speech,
        turn: state.turn,
        embedding
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
    debatePackage: state.debatePackage,
    graph: stripGraph(state.graph)
  };
}