
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

export function createNode({ speaker, text, turn }) {

    return {
        id: `${speaker}_${turn}_${Date.now()}`,
        speaker,
        text,
        turn,

        // NEW ARGUMENT STRUCTURE
        claims: extractClaims(text),
        stance: null, // support | oppose | neutral
        relation: null, // reply | support | refute | extend
        targetNodes: [],

        repliesTo: null,
        contradicts: [],

        strength: 0,
        heat: 0,
        viral: false,
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
export function detectViralNodes(state, node) {
const keywords = ["war", "crime", "illegal", "scandal", "corrupt", "collapse"];

const text = node.text.toLowerCase();

const heat = keywords.filter(k => text.includes(k)).length;

node.heat = heat + state.heat;

if (node.heat >= 2 || node.relation === "refute") {
    node.viral = true;
}
}