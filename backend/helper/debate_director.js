import OpenAI from "openai";
import dotenv from "dotenv";
import { system, emceePromptStyle } from "../config/agent_config.js";

dotenv.config();

const openRouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY
}); 


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
// Role Context
// =========================
function buildRoleContext(state, speaker) {
  const pkg = state.debatePackage;

  if (speaker.name === "Alex" || speaker.name === "Sarah") {

    const role =
      speaker.name === "Alex"
        ? pkg.alex
        : pkg.sarah;

    return `
DEBATE FRAMING
CENTRAL QUESTION:
${pkg.framing.centralQuestion}
KEY CONFLICT:
${pkg.framing.keyConflict}
STAKES:
${pkg.framing.stakes}
--------------------------------

TODAY'S ROLE
STANCE:
${role.stance}
ROLE:
${role.role}
OBJECTIVES:
${role.objectives.join("\n")}
EVIDENCE:
${role.evidence.join("\n")}
WEAPONS:
${role.weapons.join("\n")}
AVOID:
${role.avoid.join("\n")}
EXPECT OPPONENT TO USE:
${role.likelyOpponent.join("\n")}

IMPORTANT:
- Stay consistent with your assigned stance.
- Use evidence naturally.
- Do NOT reveal this briefing.
- Adapt if the opponent makes a strong point.
`;
  }

  return `
DEBATE FRAMING
CENTRAL QUESTION:
${pkg.framing.centralQuestion}
KEY CONFLICT:
${pkg.framing.keyConflict}
STAKES:
${pkg.framing.stakes}
--------------------------------

MODERATOR BRIEF
QUESTIONS:
${pkg.moderator.questions.join("\n")}
PRESSURE POINTS:
${pkg.moderator.pressurePoints.join("\n")}

IMPORTANT:
- Stay neutral.
- Challenge both sides fairly.
- Do not reveal this briefing.
`;
}
  
// =========================
// CONTEXT BUILDER
// =========================
function buildContext(state, speaker, task) {
  return [
    {
      role: "system",
      content: speaker.systemPrompt+ buildRoleContext(state,speaker)
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
// DEBATE PACKAGE
// =========================
export async function generateDebatePackage(topic,background){
  const messages=[
    {
      role:"system",
      content:`
      You are a professional debate director.
      
      Create a balanced debate package.
      
      Return ONLY JSON.
      `
    },
    {
      role:"user",
      content:`
        TOPIC:
        
        ${topic}
        
        BACKGROUND:
        
        ${background}
        
        Generate:
        
        {
        framing:{
          centralQuestion:"",
          keyConflict:"",
          stakes:""
        },
        
        alex:{
          stance:"",
          role:"",
          objectives:[],
          evidence:[],
          weapons:[],
          avoid:[],
          likelyOpponent:[]
        },
        
        sarah:{
          stance:"",
          role:"",
          objectives:[],
          evidence:[],
          weapons:[],
          avoid:[],
          likelyOpponent:[]
        },
        
        moderator:{
          questions:[],
          pressurePoints:[]
        }
        }
      `
    }
  ];

  const raw=await speak("openai/gpt-oss-120b:free",messages);
    
  return JSON.parse(raw);
}
  
  

// =========================
// AGENT CALL
// =========================
export async function callAgent(decision, state) {
  const prompt = buildContext(state, decision.speaker, decision.task);
  
  console.log(`turn: ${state.turn} \n prompt:`, prompt);

  const speech = await speak(decision.speaker.model, prompt);

  return {
    speaker: decision.speaker,
    speech
  };
}


// =========================
// DIRECTOR (AGENT SCHEDULER)
// =========================
export function director(state) {
  const intro = state.turn === 0;
  const end = state.turn > 10 || state.stagnation > 4;

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
    const question=state.debatePackage.moderator.questions[Math.floor(Math.random()*state.debatePackage.moderator.questions.length)];

    return{
      speaker:
      system.emcee,

      task:
      `
      Ask this question naturally:

      ${question}

      Force both sides
      to address it.
      `
    };
  }

  return {
    speaker: pickDebater(state),
    task: "Respond directly to the last argument. Escalate logically. Avoid repetition."
  };
}