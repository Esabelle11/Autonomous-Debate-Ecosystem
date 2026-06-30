import OpenAI from "openai";
import dotenv from "dotenv";
import { system, emceePromptStyle } from "../config/agent_config.js";
import {retry} from  "../helper/retry.js"

dotenv.config();

const openRouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY
}); 


// =========================
// LLM
// =========================
export async function speak(model, messages) {

  const res = await openRouter.chat.completions.create({
    model,
    messages
  });

  return res.choices[0].message.content;
}

// =========================
// Memory Context
// =========================
function getFilteredMemory(state, speaker) {
  const phase = state.phase;
  const speakerName = speaker.name;

  // Rule 1: For BUILDING phase, show nothing
  if (phase === "BUILDING" || phase === "OPENING") {
    return "";
  }

  // Rule 2: For CLASH or CONSOLIDATION, show only the very last memory entry
  if (phase === "CLASH") {
    if (speakerName === "Marcus") {
      return `CURRENT DEBATE CONTENT:\n${state.memory.join("\n")}`;
    }

    if (!state.memory || state.memory.length === 0) return "";

    return `LAST SPEAKER CONTENT:\n${state.memory[state.memory.length - 1]}`;
  }

  if (phase === "CONSOLIDATION") {
    if (speakerName === "Marcus") {
      return "";
    }
    if (!state.memory || state.memory.length === 0) return "";
    return `CURRENT DEBATE CONTENT:\n${state.memory.join("\n")}`;
  }


  // Rule 3: For CLOSING phase
  if (phase === "CLOSING") {
    if (!state.memory) return "";

    // If it's Marcus, display the whole memory
    if (speakerName === "Marcus") {
      return `FULL DEBATE CONTENT:\n${state.memory.join("\n")}`;
    }

    // If it's Sarah or Alex, only display lines that start with their name
    if (speakerName === "Sarah" || speakerName === "Alex") {
      const filtered = state.memory.filter(line => 
        line.startsWith(`${speakerName}:`)
      );
      return `OUTPUT HISTORY:\n${filtered.join("\n")}`;
    }
  }

  // Default fallback: return full memory with standard title if phase doesn't match above
  return state.memory && state.memory.length > 0 
    ? `RECENT MEMORY:\n${state.memory.join("\n")}` 
    : "";
}

  
// =========================
// Role Context
// =========================
/**
 * Safely converts a value into a joined string.
 * Handles arrays, single strings, null/undefined, and empty arrays gracefully.
 */
function safeJoin(value, separator = "\n") {
  if (!value) return "";
  const arr = Array.isArray(value) ? value : [value];
  return arr.filter(item => item && String(item).trim() !== "").join(separator);
}
function getSafeItem(arr, index) {
  if (!Array.isArray(arr) || !arr[index]) return "";
  return String(arr[index]).trim();
}
function safeSliceAndJoin(arr, start, end, separator = "\n") {
  if (!Array.isArray(arr)) return "";
  
  // Use JS .slice() which mimics Python's slicing behavior
  const sliced = end !== undefined ? arr.slice(start, end) : arr.slice(start);
  
  // Clean up and join into a single string
  return sliced
    .filter(item => item && String(item).trim() !== "")
    .join(separator);
}


function buildRoleContext(state, speaker) {
  const pkg = state.debatePackage;
 
  if (speaker.name === "Alex" || speaker.name === "Sarah") {
    const role = speaker.name === "Alex" ? pkg.alex : pkg.sarah;
    
    return `
DEBATE FRAMING
CENTRAL QUESTION:
${pkg.framing?.centralQuestion || "N/A"}
KEY CONFLICT:
${pkg.framing?.keyConflict || "N/A"}
STAKES:
${pkg.framing?.stakes || "N/A"}
--------------------------------

TODAY'S ROLE
STANCE:
${role.stance || "N/A"}
ROLE:
${role.role || "N/A"}
`.replace(/\n{3,}/g, '\n\n').trim(); // Cleans up extra blank lines dynamic hiding might leave behind
  }


  return `
DEBATE FRAMING
CENTRAL QUESTION:
${pkg.framing?.centralQuestion || "N/A"}
KEY CONFLICT:
${pkg.framing?.keyConflict || "N/A"}
STAKES:
${pkg.framing?.stakes || "N/A"}
`.replace(/\n{3,}/g, '\n\n').trim();
}


  
function buildPhaseContext(state, speaker) {
  const pkg = state.debatePackage;

  const phaseGoal = {
    BUILD: "Establish your position with clear claims.",
    CLASH: "Attack opponent’s strongest argument and defend your weak points.",
    CONSOLIDATION: "Strengthen your position and concede strategically.",
    CLOSING: "Summarize FROM OUTPUT HISTORY without introducing new arguments."
  };

  if (speaker.name === "Alex" || speaker.name === "Sarah") {
    const role = speaker.name === "Alex" ? pkg.alex : pkg.sarah;
    const indexToUse = state.phaseturn < 3 ? 0 : 1;


    const knownFacts = safeJoin(pkg.knownFacts);
    const reasoning = safeJoin(role.arguments);
    const openingStrategy = safeJoin(role.openingStrategy);
    const coreClaims = safeJoin(role.coreClaims);
    const attackVectors = state.phaseturn < 3 
                          ? safeSliceAndJoin(role.attackVectors, 0, 2)  
                          : safeSliceAndJoin(role.attackVectors, 2); 
    const reframeAngles = getSafeItem(role.reframeAngles, indexToUse);
    const likelyWeaknesses = getSafeItem(role.likelyWeaknesses, indexToUse);
    const concessions = safeJoin(role.concessions);
    const closingThemes = safeJoin(role.closingThemes);

    // Build chunks only if they are active, managing newlines tightly
    const buildSection = state.phase === "BUILD" 
      ? `\nOPENING STRATEGY:\n${openingStrategy}\n\nCORE CLAIMS:\n${coreClaims}` 
      : "";

    const clashSection = state.phase === "CLASH" 
      ? `\nATTACK VECTORS:\n${attackVectors}\n\nREFRAME ANGLES:\n${reframeAngles}\n\nKNOWN WEAKNESSES:\n${likelyWeaknesses}` 
      : "";

    const consolidationSection = state.phase === "CONSOLIDATION" 
      ? `\nCONCESSIONS:\n${concessions}\n\nREFRAME ANGLES:\n${reframeAngles}` 
      : "";

    const closingSection = state.phase === "CLOSING" 
      ? `\nCLOSING THEMES:\n${closingThemes}` 
      : "";

    return `
CURRENT PHASE: ${state.phase || "N/A"}

GOAL:
${phaseGoal[state.phase] || ""}

KNOWN FACTS:
${knownFacts}

REASONING POINTS:
${reasoning}${buildSection}${clashSection}${consolidationSection}${closingSection}
`.trim();
  }

//   const questions = safeJoin(pkg.moderator?.questions);
//   const pressurePoints = safeJoin(pkg.moderator?.pressurePoints);

// MODERATOR QUESTIONS:
// ${questions}

// PRESSURE POINTS:
// ${pressurePoints}

  return `
MODERATOR MODE
CURRENT PHASE: ${state.phase}
`.trim();
}

// =========================
// CONTEXT BUILDER
// =========================
// Your main buildContext function
function buildContext(state, speaker, task) {
  const formattedMemoryBlock = getFilteredMemory(state, speaker);
  // console.log("task: ",task)

  return [
    {
      role: "system",
      content: speaker.systemPrompt + buildRoleContext(state, speaker)
    },
    {
      role: "system",
      content: `
TOPIC: ${state.topic}
BACKGROUND: ${state.background}

${formattedMemoryBlock}

LAST SPEAKER: ${state.lastSpeaker?.name || "None"}
      `.trim()
    },
    {
      role: "user",
      content: buildPhaseContext(state, speaker) + "\n" + task
    }
  ];
}


// =========================
// DEBATE PACKAGE
// =========================
export async function generateDebatePackage(topic, background) {
  const messages = [
    {
      role: "system",
      content: `You are a creative reality TV and podcast producer. Your job is to create a punchy, easy-to-understand debate strategy guide for our show.

CRITICAL FACTUAL LAW:
- You are strictly FORBIDDEN from mentioning external real-world entities, celebrities, specific court cases, statistics, studies, laws, or historical events NOT present in the BACKGROUND.
- Keep the language at a simple, everyday level. Do NOT use heavy political theory, academic jargon, or complex philosophical terms. Talk about real human impacts, not abstract concepts.
- If the background does not mention an event, it does not exist.

Return VALID JSON ONLY. No markdown, no prose.`
    },
    {
      role: "user",
      content: `
TOPIC:
${topic}

BACKGROUND:
${background}

Generate the strategy package using this exact JSON structure. 
CRITICAL: Write all fields using short, casual, punchy language (6th-grade level). Use simple real-world metaphors (e.g., "copying homework," "using a GPS") instead of academic jargon.
{
  "framing": { 
    "centralQuestion": "Simple 'should we' question", 
    "keyConflict": "Simple value vs value", 
    "stakes": "What happens if either goes too far" 
  },
  "knownFacts": ["Simple fact 1", "Simple fact 2"],
  "alex": {
    "stance": "Punchy core argument", 
    "role": "Casual team identity",
    "openingStrategy": ["Simple move 1", "Simple move 2"],
    "coreClaims": ["Basic claim 1", "Basic claim 2"],
    "arguments": ["Everyday logic chain 1", "Everyday logic chain 2"],
    "attackVectors": ["How to punch opponent's idea 1", "How to punch opponent's idea 2","How to punch opponent's idea 3", "How to punch opponent's idea 4"],
    "reframeAngles": ["How to change the subject 1", "How to change the subject 2"],
    "concessions": ["What to admit is true 1", "What to admit is true 2"],
    "likelyWeaknesses": ["Where they are vulnerable 1", "Where they are vulnerable 2"],
    "closingThemes": ["Final simple takeaway 1", "Final simple takeaway 2"]
  },
  "sarah": {
    "stance": "Punchy core argument", 
    "role": "Casual team identity",
    "openingStrategy": ["Simple move 1", "Simple move 2"],
    "coreClaims": ["Basic claim 1", "Basic claim 2"],
    "arguments": ["Everyday logic chain 1", "Everyday logic chain 2"],
    "attackVectors": ["How to punch opponent's idea 1", "How to punch opponent's idea 2","How to punch opponent's idea 3", "How to punch opponent's idea 4"],
    "reframeAngles": ["How to change the subject 1", "How to change the subject 2"],
    "concessions": ["What to admit is true 1", "What to admit is true 2"],
    "likelyWeaknesses": ["Where they are vulnerable 1", "Where they are vulnerable 2"],
    "closingThemes": ["Final simple takeaway 1", "Final simple takeaway 2"]
  },
  "moderator": {
    "questions": ["Casual question to Alex", "Casual question to Sarah"],
    "pressurePoints": ["Where to press Alex", "Where to press Sarah"],
    "factChecks": ["Call out Alex's bias", "Call out Sarah's bias"],
    "tradeoffs": ["The simple catch-22 choice"]
  }
}
Return JSON only.`
    }
  ];
  const raw = await retry(() => speak("openai/gpt-oss-120b:free",messages));
  return JSON.parse(raw);
}


// =========================
// AGENT CALL
// =========================
export async function callAgent(decision, state) {
  const prompt = buildContext(state, decision.speaker, decision.task);
  
  // console.log(`turn: ${state.turn} \n prompt:`, prompt);

  const speech = await retry(() => speak(decision.speaker.model, prompt));

  return {
    speaker: decision.speaker,
    speech
  };
}

