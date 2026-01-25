import { Edge, Node } from 'reactflow';

export interface LayoutStrategy {
    layout(nodes: Node[], edges: Edge[]): { nodes: Node[], edges: Edge[] };
}
