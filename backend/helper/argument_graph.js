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

export function createRuntimeNode({speaker, phase, turn,phaseId,phaseTurn, text, embedding, stance}){
    return{
        id:`${speaker}_${turn}`,
        speaker,
        phase,
        turn,
        phaseId,
        phaseTurn,
        text,
        embedding,
        claims: extractClaims(text),
        stance,
        contradicts: [],
        repliesTo:null,
        replyChildren:[],
        metrics:{
            strength:0,
            viralScore:0,
            viral: false,
        }

    }
}



// =========================
// GRAPH BUILDER
// =========================
export function linkNode(state, node) {

    // Store all parent ids
    node.repliesTo = [...state.reply_to];

    // Create reply edges
    for (const parentId of state.reply_to) {

        const parent = state.graph.nodes.find(n => n.id === parentId);

        if (!parent) continue;

        parent.replyChildren.push(node.id);

        state.graph.edges.push({
            from: parentId,
            to: node.id,
            type: "reply"
        });
    }

    // Add node to graph
    state.graph.nodes.push(node);

    // Remember latest node
    state.lastNode = node;
}




  
export function scoreRuntimeNode(node){

    let score=0;

    if(node.text.length>180)
        score+=2;

    if(node.claims.length>1)
        score+=1;

    if(node.phase==="CLASH")
        score+=2;

    const reasoningWords=[
        "because",
        "therefore",
        "however",
        "thus",
        "although"
    ];

    if(reasoningWords.some(w=>node.text.toLowerCase().includes(w)))
        score+=2;

    node.metrics.strength=Math.min(score,10);

}

// =========================
// VIRAL DETECTION
// =========================
export async function detectViralNodes(state, node) {
    console.log("node before in detectViralNodes: ",node.metrics.viralScore)
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
    node.metrics.viralScore =
        keywordScore +
        disagreementScore +
        noveltyScore * 4 +
        emotionScore * 2;

    // =========================
    // THRESHOLD
    // =========================
    node.metrics.viral =node.metrics.viralScore > 5;

    // store reason
    // node.viralBreakdown = {
    //     keywordScore,
    //     disagreementScore,
    //     noveltyScore,
    //     emotionScore
    // };
    console.log("node after in detectViralNodes: ",node.metrics.viralScore)


}