import { getCompactNodeHeight, getCompactNodeWidth } from "@/config/constants";
import { Edge, Node } from "reactflow";
import { LayoutStrategy } from "./LayoutStrategy";
import { GraphNode } from "./RecursiveFamilyLayoutStrategy";

export class CompactFamilyLayoutStrategy implements LayoutStrategy {
  private nodesMap: Map<string, GraphNode> = new Map();
  private nodeWidth: number;
  private nodeHeight: number;
  private xGap = 40; // Reduced gap for narrower nodes
  private spouseGap = 40;
  private spouseStep = 40; // Smaller overlap for narrower nodes
  private yGap = 350; // Increased vertical gap for taller nodes
  private globalX = 0;

  private primaryParent: Map<string, string | null> = new Map();

  constructor() {
    this.nodeWidth = getCompactNodeWidth();
    this.nodeHeight = getCompactNodeHeight();
  }

  layout(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
    this.nodesMap.clear();
    this.primaryParent.clear();
    this.globalX = 0;

    // 1) Initialize GraphNodes
    nodes.forEach((n) => {
      this.nodesMap.set(n.id, {
        id: n.id,
        width: this.nodeWidth,
        height: this.nodeHeight,
        x: 0,
        y: 0,
        level: 0,
        spouses: [],
        children: [],
        parents: [],
        gender: n.data.gender,
        ageKey: this.getAgeKey(n),
        visited: false,
        treeX: 0,
        finalX: 0,
        modifier: 0,
      });
    });

    // 2) Build Relationships
    edges.forEach((e) => {
      const source = this.nodesMap.get(e.source);
      const target = this.nodesMap.get(e.target);
      if (!source || !target) return;

      if (e.data?.type === "spouse" || e.type === "spouse") {
        if (!source.spouses.includes(target.id)) source.spouses.push(target.id);
        if (!target.spouses.includes(source.id)) target.spouses.push(source.id);
      } else {
        // Parent -> Child
        if (!source.children.includes(target.id))
          source.children.push(target.id);
        if (!target.parents.includes(source.id)) target.parents.push(source.id);
      }
    });

    // 2.1) Sort children
    this.sortAllChildrenByAge();

    // 2.2) Compute primaryParent
    this.computePrimaryParents();

    // 3) Find Roots
    const roots = Array.from(this.nodesMap.values()).filter(
      (n) => n.parents.length === 0,
    );

    const processedRoots = new Set<string>();
    const finalRoots: GraphNode[] = [];

    roots.sort((a, b) => a.ageKey - b.ageKey);

    roots.forEach((root) => {
      if (processedRoots.has(root.id)) return;

      finalRoots.push(root);
      processedRoots.add(root.id);

      root.spouses.forEach((sId) => {
        if (roots.find((r) => r.id === sId)) processedRoots.add(sId);
      });
    });

    // 4) Layout each root (forest)
    this.nodesMap.forEach((n) => {
      n.visited = false;
      n.level = 0;
    });

    const levelVisited = new Set<string>();
    finalRoots.forEach((root) => {
      this.calculateLevel(root, 0, levelVisited);
    });

    finalRoots.forEach((root) => {
      this.layoutTree(root);
    });

    // 5) Map back to ReactFlow nodes
    const layoutedNodes = nodes.map((node) => {
      const gNode = this.nodesMap.get(node.id);
      if (gNode) {
        node.position = { x: gNode.x, y: gNode.y };
      }
      return node;
    });

    return { nodes: layoutedNodes, edges };
  }

  private getAgeKey(n: Node): number {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d: any = n.data ?? {};

    if (typeof d.birth_date === "string" && d.birth_date) {
      const t = Date.parse(d.birth_date);
      if (!Number.isNaN(t)) return t;
    }

    if (typeof d.created_at === "string" && d.created_at) {
      const t = Date.parse(d.created_at);
      if (!Number.isNaN(t)) return t;
    }

    return Number.POSITIVE_INFINITY;
  }

  private sortAllChildrenByAge() {
    for (const node of this.nodesMap.values()) {
      if (node.children.length <= 1) continue;

      node.children.sort((aId, bId) => {
        const a = this.nodesMap.get(aId);
        const b = this.nodesMap.get(bId);
        if (!a || !b) return 0;
        if (a.ageKey !== b.ageKey) return a.ageKey - b.ageKey;
        return a.id.localeCompare(b.id);
      });
    }
  }

  private computePrimaryParents() {
    for (const n of this.nodesMap.values()) {
      if (n.parents.length === 0) {
        this.primaryParent.set(n.id, null);
        continue;
      }
      const sorted = [...n.parents].sort((a, b) => a.localeCompare(b));
      this.primaryParent.set(n.id, sorted[0]);
    }
  }

  private calculateLevel(node: GraphNode, level: number, visited: Set<string>) {
    const key = `${node.id}@${level}`;
    if (visited.has(key)) return;
    visited.add(key);

    if (node.level < level) node.level = level;

    node.spouses.forEach((sId) => {
      const spouse = this.nodesMap.get(sId);
      if (!spouse) return;

      if (spouse.level < level) spouse.level = level;

      spouse.children.forEach((cId) => {
        const child = this.nodesMap.get(cId);
        if (child) this.calculateLevel(child, level + 1, visited);
      });
    });

    node.children.forEach((cId) => {
      const child = this.nodesMap.get(cId);
      if (child) this.calculateLevel(child, level + 1, visited);
    });
  }

  private layoutTree(node: GraphNode): number {
    if (node.visited) return node.x + node.width / 2;
    node.visited = true;

    const familyMembers: GraphNode[] = [node];
    node.spouses.forEach((sId) => {
      const s = this.nodesMap.get(sId);
      if (s && !s.visited) {
        s.visited = true;
        familyMembers.push(s);
      }
    });

    this.sortFamilyMembers(familyMembers);

    const familyIds = new Set<string>(familyMembers.map((m) => m.id));
    const childrenIds = new Set<string>();
    familyMembers.forEach((m) => m.children.forEach((c) => childrenIds.add(c)));

    // eslint-disable-next-line prefer-const
    let children = Array.from(childrenIds)
      .map((id) => this.nodesMap.get(id)!)
      .filter((c) => c !== undefined)
      .filter((child) => {
        const pp = this.primaryParent.get(child.id);
        if (!pp) return false;
        return familyIds.has(pp);
      });

    children.sort((a, b) => {
      if (a.ageKey !== b.ageKey) return a.ageKey - b.ageKey;
      return a.id.localeCompare(b.id);
    });

    let subtreeCenterX = 0;

    let familyVisualWidth = this.nodeWidth;
    if (familyMembers.length > 1) {
      const spouseCount = familyMembers.length - 1;
      const spousesStackWidth =
        this.nodeWidth + (spouseCount - 1) * this.spouseStep;
      familyVisualWidth += this.spouseGap + spousesStackWidth;
    }

    if (children.length === 0) {
      const startX = this.globalX;
      this.placeFamily(familyMembers, startX, node.level);
      this.globalX += familyVisualWidth + this.xGap;
      subtreeCenterX = startX + this.nodeWidth / 2;
    } else {
      const minStartX = this.globalX;

      const childCenters: number[] = [];
      children.forEach((child) => {
        if (child.visited) {
          childCenters.push(child.x + child.width / 2);
        } else {
          childCenters.push(this.layoutTree(child));
        }
      });

      const firstChildCenter = childCenters[0];
      const lastChildCenter = childCenters[childCenters.length - 1];
      subtreeCenterX = (firstChildCenter + lastChildCenter) / 2;

      let startX = subtreeCenterX - this.nodeWidth / 2;

      if (startX < minStartX) {
        startX = minStartX;
        subtreeCenterX = startX + this.nodeWidth / 2;
      }

      this.placeFamily(familyMembers, startX, node.level);

      const rightEdge = startX + familyVisualWidth + this.xGap;
      if (rightEdge > this.globalX) this.globalX = rightEdge;
    }

    return subtreeCenterX;
  }

  private placeFamily(members: GraphNode[], startX: number, level: number) {
    if (members.length === 0) return;

    const mainNode = members[0];
    mainNode.x = startX;
    mainNode.y = level * this.yGap;

    if (members.length > 1) {
      const spousesStartX = startX + this.nodeWidth + this.spouseGap;

      for (let i = 1; i < members.length; i++) {
        const spouse = members[i];
        spouse.x = spousesStartX + (i - 1) * this.spouseStep;
        spouse.y = level * this.yGap;
      }
    }
  }

  private genderRank(g?: string): number {
    if (g === "male") return 0;
    if (g === "female") return 1;
    return 2; // unknown last
  }

  private sortFamilyMembers(members: GraphNode[]) {
    members.sort((a, b) => {
      const ra = this.genderRank(a.gender);
      const rb = this.genderRank(b.gender);
      if (ra !== rb) return ra - rb;

      // same gender: older on the left
      if (a.ageKey !== b.ageKey) return a.ageKey - b.ageKey;

      // stable fallback
      return a.id.localeCompare(b.id);
    });
  }
}
