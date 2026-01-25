import { getNodeHeight, getNodeWidth } from '@/config/constants';
import dagre from 'dagre';
import { Edge, Node, Position } from 'reactflow';
import { LayoutStrategy } from './LayoutStrategy';

export class DagreLayoutStrategy implements LayoutStrategy {
    layout(nodes: Node[], edges: Edge[]): { nodes: Node[], edges: Edge[] } {
        const dagreGraph = new dagre.graphlib.Graph();
        dagreGraph.setDefaultEdgeLabel(() => ({}));

        const nodeWidth = getNodeWidth();
        const nodeHeight = getNodeHeight();
        
        // Set direction to Top-Down
        // Increase ranksep (vertical separation) to accommodate taller nodes if needed, 
        // but since we reduced height, we can adjust.
        // ranksep: vertical gap between levels
        dagreGraph.setGraph({ rankdir: 'TB', ranksep: 150, nodesep: 50 });

        nodes.forEach((node) => {
            dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
        });

        edges.forEach((edge) => {
            // If spouse, we want them on same rank. 
            // Dagre doesn't strictly enforce "same rank" easily without constraints, 
            // but if we make the edge weight high or use rank sets?
            // Dagre puts connected nodes in hierarchy. Spouse is horizontal.
            // We can trick dagre by making spouse relationship minlen: 0 and rank: same?
            // Dagre options for edge: { minlen, weight, labelpos, labeloffset }
            
            if (edge.type === 'custom' && edge.data?.type === 'spouse') {
               // Spouse: prevent vertical separation
               // constraint: same rank? Dagre graphlib supports rank constraints via 'rank' attribute on nodes, not edges directly?
               // Actually dagre supports `minlen: 0` which might pull them together vertically?
               // But if rankdir is TB, minlen is vertical distance.
               dagreGraph.setEdge(edge.source, edge.target, { minlen: 0, weight: 10 });
            } else {
               // Parent-Child: standard vertical separation
               dagreGraph.setEdge(edge.source, edge.target, { minlen: 2 });
            }
        });

        dagre.layout(dagreGraph);

        const layoutedNodes = nodes.map((node) => {
            const nodeWithPosition = dagreGraph.node(node.id);
            node.targetPosition = Position.Top;
            node.sourcePosition = Position.Bottom;

            // Dagre gives center point
            // Check if nodeWithPosition exists (it should)
            if (nodeWithPosition) {
                node.position = {
                    x: nodeWithPosition.x - nodeWidth / 2,
                    y: nodeWithPosition.y - nodeHeight / 2,
                };
            }
            
            return node;
        });
        
        return { nodes: layoutedNodes, edges };
    }
}
