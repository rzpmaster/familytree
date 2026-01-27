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

  // =========================
  // Group-based sorting helpers
  // =========================

  // 保存原始 node.data（用于 birth_date / created_at）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private __rawDataMap: Map<string, any> = new Map();

  private hasBirthDate(n: GraphNode): boolean {
    const d = this.__rawDataMap.get(n.id) ?? {};
    return (
      typeof d.birth_date === "string" &&
      !!d.birth_date &&
      !Number.isNaN(Date.parse(d.birth_date))
    );
  }

  private birthDateValue(n: GraphNode): number {
    const d = this.__rawDataMap.get(n.id) ?? {};
    const t = Date.parse(d.birth_date);
    return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
  }

  private hasSortOrder(n: GraphNode): boolean {
    return typeof n.sort_order === "number";
  }

  private sortOrderValue(n: GraphNode): number {
    return typeof n.sort_order === "number"
      ? n.sort_order
      : Number.POSITIVE_INFINITY;
  }

  private hasCreatedAt(n: GraphNode): boolean {
    const d = this.__rawDataMap.get(n.id) ?? {};
    return (
      typeof d.created_at === "string" &&
      !!d.created_at &&
      !Number.isNaN(Date.parse(d.created_at))
    );
  }

  private createdAtValue(n: GraphNode): number {
    const d = this.__rawDataMap.get(n.id) ?? {};
    const t = Date.parse(d.created_at);
    return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
  }

  /**
   * 排序规则（针对“同一组兄弟 / roots / familyMembers”）：
   * 1. 全都有 birth_date → 按 birth_date
   * 2. 否则全都有 sort_order → 按 sort_order
   * 3. 否则：
   *    - 有 birth_date 的排前（内部按 birth_date）
   *    - 再是有 sort_order 的（内部按 sort_order）
   *    - 最后都没有的按 created_at
   * 4. 最终兜底 id
   */
  private compareByGroupRule(
    group: GraphNode[],
    a: GraphNode,
    b: GraphNode,
  ): number {
    const allHaveBirth =
      group.length > 0 && group.every((n) => this.hasBirthDate(n));
    const allHaveSort =
      group.length > 0 && group.every((n) => this.hasSortOrder(n));

    // Rule 1: 全都有 birth_date
    if (allHaveBirth) {
      const da = this.birthDateValue(a);
      const db = this.birthDateValue(b);
      if (da !== db) return da - db;
      return a.id.localeCompare(b.id);
    }

    // Rule 2: 全都有 sort_order
    if (allHaveSort) {
      const sa = this.sortOrderValue(a);
      const sb = this.sortOrderValue(b);
      if (sa !== sb) return sa - sb;
      return a.id.localeCompare(b.id);
    }

    // Rule 3: 混合
    const aHasBirth = this.hasBirthDate(a);
    const bHasBirth = this.hasBirthDate(b);
    if (aHasBirth !== bHasBirth) return aHasBirth ? -1 : 1;
    if (aHasBirth && bHasBirth) {
      const da = this.birthDateValue(a);
      const db = this.birthDateValue(b);
      if (da !== db) return da - db;
      return a.id.localeCompare(b.id);
    }

    const aHasSort = this.hasSortOrder(a);
    const bHasSort = this.hasSortOrder(b);
    if (aHasSort !== bHasSort) return aHasSort ? -1 : 1;
    if (aHasSort && bHasSort) {
      const sa = this.sortOrderValue(a);
      const sb = this.sortOrderValue(b);
      if (sa !== sb) return sa - sb;
      return a.id.localeCompare(b.id);
    }

    // 都没有 → created_at
    const ca = this.createdAtValue(a);
    const cb = this.createdAtValue(b);
    if (ca !== cb) return ca - cb;

    return a.id.localeCompare(b.id);
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

    if (typeof d.sort_order === "number") {
      return d.sort_order;
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
