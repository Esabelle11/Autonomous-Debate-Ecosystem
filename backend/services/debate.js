import dotenv from "dotenv";
import { emceePromptStyle } from "../config/agent_config.js";
import { createState, updateHeat, updateStagnation, updateMemory} from "../helper/debate_state.js";
import { generateDebatePackage, director, callAgent} from "./debate_director.js";
import { createRuntimeNode, linkNode, scoreRuntimeNode, detectViralNodes} from "../helper/argument_graph.js";
import { getEmbedding } from "../helper/embedding.js";
import { buildSemanticGraph } from "../helper/semantic_graph_builder.js";

dotenv.config();

function stripGraph(graph) {
  return {
    nodes: graph.nodes.map(({ embedding, ...rest }) => rest),
    edges: graph.edges,
    semanticEdges: graph.semanticEdges,
    themes: graph.themes,
    communities: graph.communities,
  };
}

function stance_retrieve(state,speaker_name) {
  const pkg = state.debatePackage;
  if (speaker_name === "Alex" || speaker_name === "Sarah") {
    const role = speaker_name === "Alex" ? pkg.alex : pkg.sarah;
    return role.stance
  }
  return "Moderator"
}



// =========================
// MAIN ENGINE
// =========================
export async function generateDebate(topic, background) {
  const state = createState(topic, background);
  
  state.debatePackage= await generateDebatePackage(topic, background);
  // console.log("[state.debatePackage] : ", state.debatePackage)
  while (true) {
    const decision = director(state);
    // console.log("decision: ",decision)

    const result = await callAgent(decision, state);

    const embedding = await getEmbedding(result.speech);

    // const node = createNode({
    //     speaker: result.speaker.name,
    //     text: result.speech,
    //     turn: state.turn,
    //     embedding
    // });

    const node = createRuntimeNode({
      speaker: result.speaker.name,
      phase: state.phase,
      turn: state.turn,
      text: result.speech,
      embedding,
      stance: stance_retrieve(state,result.speaker.name)
    })
    // console.log("node: ",node)

    linkNode(state, node,decision.speaker);
    scoreRuntimeNode(node);
    detectViralNodes(state, node);

    updateMemory(state, result);
    updateHeat(state, result.speech);
    updateStagnation(state);

    state.lastSpeaker = result.speaker;
    state.turn++;
    // if (
    //   state.turn===3
    // ) {
    //   break;
    // }

    if (
      result.speaker.name === "Marcus" &&
      decision.task === emceePromptStyle.closing
    ) {
      break;
    }
  }

  state.graph = await buildSemanticGraph(state.graph);
  console.log("[state.graph]: ",state.graph)

  return {
    transcript: state.transcript,
    debatePackage: state.debatePackage,
    graph: stripGraph(state.graph)
  };
}