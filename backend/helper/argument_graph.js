import { cosineSimilarity } from "./similarity.js";
import { getEmbedding } from "./embedding.js";

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

export function createNode({ speaker, text, turn, embedding }) {
    return {
        id: `${speaker}_${turn}_${Date.now()}`,
        speaker,
        text,
        turn,

        claims: extractClaims(text),
        stance: null,
        relation: null,
        targetNodes: [],

        repliesTo: null,
        contradicts: [],

        strength: 0,
        viral: false,
        viralScore: 0,     // NEW
        embedding,         // NEW
        type: "claim"
    };
}


// =========================
// GRAPH BUILDER
// =========================
export function linkNode(state, node,speaker) {
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

    if(speaker.name==="Alex")
        node.stance=state.debatePackage.alex.stance;
        
    if(speaker.name==="Sarah")
        node.stance=state.debatePackage.sarah.stance;

    if(speaker.name==="Marcus")
        node.stance="neutral";
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
export function scoreNode(node) {
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
export async function detectViralNodes(state, node) {
    console.log("node before in detectViralNodes: ",node.viralScore)
    const text = node.text.toLowerCase();
    console.log("text in detectViralNodes: ",text)

    // =========================
    // 1. CONTROVERSY SIGNAL
    // =========================
    const controversyKeywords = [
        "war", "crime", "illegal", "scandal", "corrupt", "collapse"
    ];

    const keywordScore = controversyKeywords.filter(k => text.includes(k)).length * 1.5;

    // =========================
    // 2. DISAGREEMENT SIGNAL
    // =========================
    let disagreementScore = 0;

    if (node.relation === "refute") {
        disagreementScore += 3;
    }

    // boost if parent exists
    if (node.repliesTo) {
        const parent = state.graph.nodes.find(n => n.id === node.repliesTo);
        if (parent?.relation === "refute") {
            disagreementScore += 1.5;
        }
    }

    // =========================
    // 3. EMBEDDING NOVELTY 
    // =========================
    let noveltyScore = 0;

    if (state.graph.nodes.length > 1) {
        const similarities = state.graph.nodes
            .slice(-5)
            .filter(n => n.embedding)
            .map(n => cosineSimilarity(node.embedding, n.embedding));

        const avgSim =
            similarities.reduce((a, b) => a + b, 0) /
            (similarities.length || 1);

        noveltyScore = 1 - avgSim; // higher = more unique
    }

    // =========================
    // 4. GRAPH CENTRALITY (LIGHT VERSION)
    // =========================
    const connectionScore =
        (node.repliesTo ? 1 : 0) +
        node.contradicts.length * 1.5;

    // =========================
    // 5. EMOTIONAL / INTENSITY SIGNAL
    // =========================
    const emotionalWords = [
        "shocking", "outrage", "disaster",
        "unacceptable", "critical", "urgent"
    ];

    const emotionScore =
        emotionalWords.filter(w => text.includes(w)).length;

    // =========================
    // FINAL VIRAL SCORE
    // =========================
    node.viralScore =
        keywordScore +
        disagreementScore +
        noveltyScore * 4 +
        connectionScore +
        emotionScore * 2;

    // =========================
    // THRESHOLD
    // =========================
    node.viral = node.viralScore > 5;

    // store reason
    node.viralBreakdown = {
        keywordScore,
        disagreementScore,
        noveltyScore,
        connectionScore,
        emotionScore
    };
    console.log("node after in detectViralNodes: ",node.viralScore)


}