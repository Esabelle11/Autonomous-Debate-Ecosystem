
// =========================
// STATE
// =========================
export function createState(topic, background) {
    return {
        topic,
        background,

        debatePackage: null,

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
// HEAT SYSTEM
// =========================
export function updateHeat(state, speech) {
    const keywords = ["war", "crime", "illegal", "corrupt", "death"];
  
    const score = keywords.filter(k =>
      speech.toLowerCase().includes(k)
    ).length;
  
    state.heat = Math.max(0, Math.min(10, state.heat * 0.8 + score));
  }
  
  
// =========================
// STAGNATION
// =========================
export function updateStagnation(state) {
    if (state.memory.length < 4) return;
  
    const recent = state.memory.slice(-4);
    const unique = new Set(recent);
  
    if (unique.size <= 2) state.stagnation++;
    else state.stagnation = Math.max(0, state.stagnation - 1);
}
  
  
// =========================
// MEMORY
// =========================
export function updateMemory(state, result) {
    state.memory.push(`${result.speaker.name}: ${result.speech}`);
  
    state.transcript.push({
      speaker: result.speaker.name,
      text: result.speech
    });
}
  