import { cosineSimilarity } from "./similarity.js";
import { classifyRelationship } from "./relationship_classifier.js";

const MIN_SIMILARITY = 0.78;

async function inferRelationships(graph){

    const nodes = graph.nodes;

    graph.semanticEdges = [];

    for(let i=0;i<nodes.length;i++){

        const current = nodes[i];

        for(let j=0;j<i;j++){

            const previous = nodes[j];

            const similarity = cosineSimilarity(
                current.embedding,
                previous.embedding
            );

            if(similarity < MIN_SIMILARITY)
                continue;

            const result =
                await classifyRelationship(
                    previous,
                    current
                );

            if(result.type==="none")
                continue;

            graph.semanticEdges.push({

                from: previous.id,

                to: current.id,

                type: result.type,

                confidence: result.confidence

            });

        }

    }

}

function clusterThemes(graph){

    const visited=new Set();

    graph.themes=[];

    let themeIndex=1;

    for(const node of graph.nodes){

        if(visited.has(node.id))
            continue;

        const cluster=[];

        cluster.push(node.id);

        visited.add(node.id);

        for(const other of graph.nodes){

            if(node.id===other.id)
                continue;

            if(visited.has(other.id))
                continue;

            const sim=cosineSimilarity(
                node.embedding,
                other.embedding
            );

            if(sim>0.88){

                cluster.push(other.id);

                visited.add(other.id);

            }

        }

        graph.themes.push({

            id:`theme_${themeIndex++}`,

            label:node.claims[0],

            nodes:cluster

        });

    }

}

function computeCentrality(graph){

    const degree={};

    graph.nodes.forEach(node=>{

        degree[node.id]=0;

    });

    const allEdges=[

        ...graph.edges,

        ...graph.semanticEdges

    ];

    allEdges.forEach(edge=>{

        degree[edge.from]++;

        degree[edge.to]++;

    });

    graph.nodes.forEach(node=>{

        node.analytics ??={};

        node.analytics.degree=

            degree[node.id];

    });

}

function computeCommunities(graph){

    graph.communities={};

    graph.nodes.forEach(node=>{

        const key=node.stance ?? "neutral";

        if(!graph.communities[key])

            graph.communities[key]=[];

        graph.communities[key].push(node.id);

    });

}

export function computeInfluentialClaims(graph){

    graph.nodes.forEach(node=>{

        const degree=node.analytics.degree ?? 0;

        const strength=node.metrics.strength ?? 0;

        const viral=node.metrics.viralScore ?? 0;

        const supports=

            graph.semanticEdges.filter(

                e=>e.to===node.id &&

                e.type==="support"

            ).length;

        const attacks=

            graph.semanticEdges.filter(

                e=>e.to===node.id &&

                e.type==="attack"

            ).length;

        node.analytics.influence=

            degree

            +strength

            +viral

            +supports*2

            +attacks;

    });

}

export async function buildSemanticGraph(graph){

    await inferRelationships(graph);

    console.log("[graph.semanticEdges]: ",graph.semanticEdges)

    clusterThemes(graph);
    // console.log("[graph.themes]: ",graph.themes)

    computeCentrality(graph);

    computeCommunities(graph);
    // console.log("[graph.communities]: ",graph.communities)

    computeInfluentialClaims(graph);

    return graph;

}