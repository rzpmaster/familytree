import { getNodeHeight, getNodeWidth } from "@/config/constants";
import { Edge, Node } from "reactflow";
import { LayoutStrategy } from "./LayoutStrategy";

export interface GraphNode {
  id: string;
  width: number;
  height: number;
  x: number;
  y: number;
  level: number;

  // Relationships
  spouses: string[];
  children: string[];
  parents: string[];

  gender?: "male" | "famale" | string;
  sort_order?: number;

  // Sorting / layout helpers
  ageKey: number; // smaller => older (used for left-to-right order)
  visited: boolean;
  treeX: number;
  finalX: number;
  modifier: number;
}

export class RecursiveFamilyLayoutStrategy implements LayoutStrategy {
  private nodesMap: Map<string, GraphNode> = new Map();
  private nodeWidth: number;
  private nodeHeight: number;
  private xGap = 50;
  private spouseGap = 50;
  private spouseStep = 100;
  private yGap = 200;
  private globalX = 0;

  // NEW: for multi-parent child, choose ONE parent to own x-ordering (keep siblings together)
  private primaryParent: Map<string, string | null> = new Map();

  constructor() {
    this.nodeWidth = getNodeWidth();
    this.nodeHeight = getNodeHeight();
  }

  layout(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
    this.nodesMap.clear();
    this.primaryParent.clear();
    this.globalX = 0;

    // 1) Initialize GraphNodes (with ageKey)
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
        sort_order: n.data.sort_order,
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

    // 2.1) NEW: sort children for every parent (older on the left)
    this.sortAllChildrenByAge();

    // 2.2) NEW: compute primaryParent for each child (deterministic)
    this.computePrimaryParents();

    // 3) Find Roots (No parents)
    const roots = Array.from(this.nodesMap.values()).filter(
      (n) => n.parents.length === 0,
    );

    // Avoid double-processing spouse roots
    const processedRoots = new Set<string>();
    const finalRoots: GraphNode[] = [];

    // NEW: root order also by age (older left)
    roots.sort((a, b) => a.ageKey - b.ageKey);

    roots.forEach((root) => {
      if (processedRoots.has(root.id)) return;

      finalRoots.push(root);
      processedRoots.add(root.id);

      root.spouses.forEach((sId) => {
        // If spouse is also root, mark it as processed
        if (roots.find((r) => r.id === sId)) processedRoots.add(sId);
      });
    });

    // 4) Layout each root (forest)
    // IMPORTANT: before layout, reset visited & level (in case strategy is reused)
    this.nodesMap.forEach((n) => {
      n.visited = false;
      n.level = 0;
    });

    // NEW: level calculation must include spouse branches too, and handle DAG safely
    const levelVisited = new Set<string>();
    finalRoots.forEach((root) => {
      this.calculateLevel(root, 0, levelVisited);
    });

    // Layout trees
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

  // NEW: age key helper
  // smaller => "older" => goes to the left
  private getAgeKey(n: Node): number {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d: any = n.data ?? {};

    // If later you have birth_date, use it first (earlier date => older)
    if (typeof d.birth_date === "string" && d.birth_date) {
      const t = Date.parse(d.birth_date);
      if (!Number.isNaN(t)) return t;
    }

    // Fallback: created_at (earlier created => more left)
    if (typeof d.created_at === "string" && d.created_at) {
      const t = Date.parse(d.created_at);
      if (!Number.isNaN(t)) return t;
    }

    // If missing, push to the right
    return Number.POSITIVE_INFINITY;
  }

  // -------------------------
  // NEW: sort children arrays by age (older left)
  // -------------------------
  private sortAllChildrenByAge() {
    for (const node of this.nodesMap.values()) {
      if (node.children.length <= 1) continue;

      node.children.sort((aId, bId) => {
        const a = this.nodesMap.get(aId);
        const b = this.nodesMap.get(bId);
        if (!a || !b) return 0;
        // smaller ageKey => older => left
        if (a.ageKey !== b.ageKey) return a.ageKey - b.ageKey;
        // stable fallback
        return a.id.localeCompare(b.id);
      });
    }
  }

  // -------------------------
  // NEW: pick ONE primary parent for each child for x-grouping
  // rule: smallest parent id (stable), you can change to "father first" etc.
  // -------------------------
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

  // -------------------------
  // FIX: calculateLevel should include spouse children too
  // and avoid infinite recursion in DAG
  // -------------------------
  private calculateLevel(node: GraphNode, level: number, visited: Set<string>) {
    // Use (nodeId, level) style pruning:
    // if we've already assigned >= level, no need to go deeper from here
    const key = `${node.id}@${level}`;
    if (visited.has(key)) return;
    visited.add(key);

    if (node.level < level) node.level = level;

    // Spouses are on same level, and their children should also be processed
    node.spouses.forEach((sId) => {
      const spouse = this.nodesMap.get(sId);
      if (!spouse) return;

      if (spouse.level < level) spouse.level = level;

      // IMPORTANT: spouse children also need level assignment (otherwise spouse-side branch is wrong)
      spouse.children.forEach((cId) => {
        const child = this.nodesMap.get(cId);
        if (child) this.calculateLevel(child, level + 1, visited);
      });
    });

    // Node children
    node.children.forEach((cId) => {
      const child = this.nodesMap.get(cId);
      if (child) this.calculateLevel(child, level + 1, visited);
    });
  }

  // -------------------------
  // Layout: recursive, but ensure siblings are grouped by same parent
  // by only laying out children whose primaryParent belongs to this family unit
  // -------------------------
  private layoutTree(node: GraphNode): number {
    if (node.visited) return node.x + node.width / 2;
    node.visited = true;

    // Family Unit (node + spouses)
    const familyMembers: GraphNode[] = [node];
    node.spouses.forEach((sId) => {
      const s = this.nodesMap.get(sId);
      if (s && !s.visited) {
        s.visited = true;
        familyMembers.push(s);
      }
    });

    this.sortFamilyMembers(familyMembers);

    // Build family id set
    const familyIds = new Set<string>(familyMembers.map((m) => m.id));

    // Collect children:
    // 1) dedupe
    // 2) ONLY include children whose primaryParent is in this family (prefer one parent for x-order)
    const childrenIds = new Set<string>();
    familyMembers.forEach((m) => m.children.forEach((c) => childrenIds.add(c)));

    // eslint-disable-next-line prefer-const
    let children = Array.from(childrenIds)
      .map((id) => this.nodesMap.get(id)!)
      .filter((c) => c !== undefined)
      .filter((child) => {
        const pp = this.primaryParent.get(child.id);
        // If pp is null, it's a root-like node; don't attach here
        if (!pp) return false;
        return familyIds.has(pp);
      });

    // Sort children by age (older left)
    children.sort((a, b) => {
      if (a.ageKey !== b.ageKey) return a.ageKey - b.ageKey;
      return a.id.localeCompare(b.id);
    });

    let subtreeCenterX = 0;

    // Compute family visual width (main + spouses stack)
    let familyVisualWidth = this.nodeWidth;
    if (familyMembers.length > 1) {
      const spouseCount = familyMembers.length - 1;
      const spousesStackWidth =
        this.nodeWidth + (spouseCount - 1) * this.spouseStep;
      familyVisualWidth += this.spouseGap + spousesStackWidth;
    }

    if (children.length === 0) {
      // Leaf family
      const startX = this.globalX;
      this.placeFamily(familyMembers, startX, node.level);
      this.globalX += familyVisualWidth + this.xGap;
      subtreeCenterX = startX + this.nodeWidth / 2;
    } else {
      // Inner node
      const minStartX = this.globalX;

      // Layout children first (left -> right)
      const childCenters: number[] = [];
      children.forEach((child) => {
        if (child.visited) {
          childCenters.push(child.x + child.width / 2);
        } else {
          childCenters.push(this.layoutTree(child));
        }
      });

      // Children center
      const firstChildCenter = childCenters[0];
      const lastChildCenter = childCenters[childCenters.length - 1];
      subtreeCenterX = (firstChildCenter + lastChildCenter) / 2;

      // Place family:
      // Align MAIN node center to children center (bloodline straight down)
      let startX = subtreeCenterX - this.nodeWidth / 2;

      // Don't move parent to the left of "boundary before laying out children"
      if (startX < minStartX) {
        startX = minStartX;
        subtreeCenterX = startX + this.nodeWidth / 2;
      }

      this.placeFamily(familyMembers, startX, node.level);

      // Update globalX if parent block extends further right than children
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
