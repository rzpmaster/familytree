import { getCompactNodeHeight, getCompactNodeWidth } from "@/config/constants";
import { Edge, Node } from "reactflow";
import { RecursiveFamilyLayoutStrategy } from "./RecursiveFamilyLayoutStrategy";

export class CompactFamilyLayoutStrategy extends RecursiveFamilyLayoutStrategy {
  constructor() {
    super();
    this.nodeWidth = getCompactNodeWidth();
    this.nodeHeight = getCompactNodeHeight();

    this.xGap = 40;
    this.spouseGap = 40;
    this.spouseStep = 40;
    this.yGap = 350;
  }

  layout(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
    return super.layout(nodes, edges);
  }
}
