
import {retry} from  "./retry.js"
import {speak} from "../services/debate_director.js"
import {relation_prompt} from "../config/agent_config.js";

const validTypes = [

    "support",

    "attack",

    "evidence",

    "concession",

    "sameTheme",

    "none"

];



function buildContext(a, b) {
   
    return [
      {
        role: "system",
        content: relation_prompt
      },
      {
        role: "user",
        content: `
Claim A: ${a.text}   
Claim B: ${b.text}
        `.trim()
      }
    ];
  }

export async function classifyRelationship(a,b){

    const prompt = buildContext(a, b)
    let result = await retry(() => speak("openai/gpt-oss-120b:free", prompt));

    if (typeof result === "string") {
      try {
          result = JSON.parse(result);
      } catch (e) {
          return {
              type: "none",
              confidence: 0
          };
      }
    }
    console.log("[classifyRelationship result]:",result)
    
    if(!validTypes.includes(result.type)){
        result.type="none"; 
        result.confidence=0;  
    }

    return result;

}