import {
  getCompactNodeHeight,
  getCompactNodeWidth,
  getNodeHeight,
  getNodeWidth,
} from "@/config/constants";
import { Member } from "@/types";
import { Edge, Node } from "reactflow";
import { LayoutStrategy } from "./LayoutStrategy";

interface MyGraphNode {
  id: string;
  member: Member;

  spouses: Set<string>; // spouse
  children: Set<string>; // parent -> child
  parents: Set<string>; // child -> parent
}

class RecursiveFamilyLayoutStrategy implements LayoutStrategy {
  protected nodeWidth: number;
  protected nodeHeight: number;
  protected xGap: number;
  protected spouseGap: number;
  protected spouseStep: number;
  protected yGap: number;

  constructor(nodeWidth, nodeHeight) {
    this.nodeWidth = nodeWidth;
    this.nodeHeight = nodeHeight;

    this.xGap = 50;
    this.spouseGap = 30;
    this.spouseStep = 100;
    this.yGap = 200;
  }

  layout(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
    // --- Build nodes map ---
    const nodesMap = this.buildDriectedGraph(nodes as Node<Member>[], edges);

    // --- Find connected components (families) ---
    const components = this.splitFamilyComponents(nodesMap);

    const familyRootCache: { roots: string[]; familyIds: string[] }[] = [];
    for (const familyIds of components) {
      const { roots } = this.computeLevelForFamily(familyIds, nodesMap);
      familyRootCache.push({ roots, familyIds });
    }
    familyRootCache.sort((a, b) =>
      this.compareSiblingMember(
        nodesMap.get(a.roots.at(0)).member,
        nodesMap.get(b.roots.at(0)).member,
      ),
    );

    // --- Layout each family and offset to avoid overlap ---
    for (const { roots, familyIds } of familyRootCache) {
      // Layout family
      // Find root and levels
      // const { roots } = this.computeLevelForFamily(familyIds, nodesMap);

      // level（y）我们先用 depth 递归确定：root=0，child=1...
      const depthMap = new Map<string, number>();

      // x 游标：每一层从左到右
      const cursorByDepth = new Map<number, number>();
      const getCursor = (d: number) => cursorByDepth.get(d) ?? 0;
      const setCursor = (d: number, v: number) => cursorByDepth.set(d, v);

      // 结果 x/y（最后写回 Member.position_x/y）
      const xMap = new Map<string, number>();
      const yMap = new Map<string, number>();

      // 缓存兄弟节点排序顺序
      const childrenOrderByParent = new Map<string, string[]>();

      //#region Placement functions
      const placeAt = (id: string, d: number, x: number) => {
        depthMap.set(id, d);
        xMap.set(id, x);
        yMap.set(id, d * (this.nodeHeight + this.yGap));
      };

      const placeSpouseRow = (rootId: string, d: number) => {
        const gn = nodesMap.get(rootId);
        const spouses = gn ? [...gn.spouses] : [];

        // spouse 顺序：按 compareSibling 排（稳定可控）
        const spouseOrder = spouses.sort((a, b) =>
          this.compareSiblingMember(
            nodesMap.get(a)?.member,
            nodesMap.get(b)?.member,
          ),
        );

        const useSpouseOverlap =
          spouseOrder.length >= 2 && this.nodeWidth > 250;

        const normalStep = this.nodeWidth + this.spouseGap;
        const step = useSpouseOverlap ? this.spouseStep : normalStep;

        // root 本人先放
        let curX = getCursor(d);
        placeAt(rootId, d, curX);
        curX += normalStep;

        // 再放所有 spouse
        for (const sp of spouseOrder) {
          placeAt(sp, d, curX);
          curX += step;
        }

        // 更新本层游标
        const all = [rootId, ...spouseOrder];
        const rightMost = Math.max(
          ...all.map((id) => (xMap.get(id) ?? 0) + this.nodeWidth),
        );
        setCursor(d, Math.max(getCursor(d), rightMost + this.xGap));

        return spouseOrder; // 返回 spouse 顺序，给孩子分组排序用
      };

      const placeChildrenGroups = (
        parentId: string,
        spouseOrder: string[],
        d: number,
      ) => {
        const gn = nodesMap.get(parentId);
        const children = gn ? [...gn.children] : [];

        // spouse index（用来给“有妈”分组排序）
        const spouseIndex = new Map<string, number>();
        spouseOrder.forEach((sp, idx) => spouseIndex.set(sp, idx));

        // 分组：按“妈(=在 spouseOrder 里的母亲)”；没有妈进 _no_mother
        type Group = {
          motherId: string | null;
          kids: string[];
          orderKey: number;
        };

        const groupsMap = new Map<string, Group>();

        const getMotherKey = (childId: string) => {
          const childGn = nodesMap.get(childId);
          if (!childGn) return "_no_mother";

          const parents = [...childGn.parents];

          // mother 必须：是 parent，且在 spouseOrder 中（即“和 spouse 的分组”）
          // 没有妈 => _no_mother
          let bestMother: string | null = null;
          let bestIdx = Number.POSITIVE_INFINITY;

          for (const p of parents) {
            if (!spouseIndex.has(p)) continue; // 不在 spouse 列表里，不算“妈分组”
            const m = nodesMap.get(p).member;
            if (!m) continue;
            if (m.gender !== "female") continue;

            const idx = spouseIndex.get(p)!;
            if (idx < bestIdx) {
              bestIdx = idx;
              bestMother = p;
            }
          }

          return bestMother ?? "_no_mother";
        };

        for (const c of children) {
          const key = getMotherKey(c);
          if (!groupsMap.has(key)) {
            // orderKey：有妈按 spouseIndex；没妈放最后
            const orderKey =
              key === "_no_mother"
                ? Number.POSITIVE_INFINITY
                : spouseIndex.get(key)!;
            groupsMap.set(key, {
              motherId: key === "_no_mother" ? null : key,
              kids: [],
              orderKey,
            });
          }
          groupsMap.get(key)!.kids.push(c);
        }

        // 每组内，按 compareSibling 排序
        for (const g of groupsMap.values())
          g.kids.sort((a, b) =>
            this.compareSiblingMember(
              nodesMap.get(a)?.member,
              nodesMap.get(b)?.member,
            ),
          );

        // 按 orderKey 排序各组
        const groups = [...groupsMap.values()].sort(
          (a, b) => a.orderKey - b.orderKey,
        );

        let curX = getCursor(d + 1);
        for (const g of groups) {
          for (const kid of g.kids) {
            placeAt(kid, d + 1, curX);
            curX += this.nodeWidth + this.xGap;
          }
          // 组间隔一下（保持块感）
          curX += this.xGap;
        }

        setCursor(d + 1, Math.max(getCursor(d + 1), curX));
        const orderedChildren = groups.flatMap((g) => g.kids); // 返回按最终顺序的孩子列表
        childrenOrderByParent.set(parentId, orderedChildren);
        return orderedChildren;
      };

      const visited = new Set<string>();
      const dfs = (id: string, d: number) => {
        if (visited.has(id)) return;
        visited.add(id);

        // 1) 先排 spouse（同层）
        const spouseOrder = placeSpouseRow(id, d);

        // 2) 再排所有孩子（下一层），按“妈分组”规则
        const orderedChildren = placeChildrenGroups(id, spouseOrder, d);

        // 3) 递归处理孩子（从 root 依次按节点排布）
        for (const c of orderedChildren) dfs(c, d + 1);
      };

      // adjust family make that parents are above children
      const adjustFamilyCentering = (
        orderedRoots: string[],
        childrenOrderByParent: Map<string, string[]>,
      ) => {
        const spousesInFamily = (id: string) => {
          const gn = nodesMap.get(id);
          if (!gn) return [];
          return [...gn.spouses];
        };
        // cluster = 本人 + spouse（保持同层一排）
        const getClusterMembers = (id: string) => {
          const arr = [id, ...spousesInFamily(id)];
          // 用 compareSibling 稳定 spouse 顺序（不改你的放置顺序，只用于算边界/移动）
          return Array.from(new Set(arr)).sort((a, b) =>
            this.compareSiblingMember(
              nodesMap.get(a)?.member,
              nodesMap.get(b)?.member,
            ),
          );
        };
        const clusterLeftRight = (id: string) => {
          const ms = getClusterMembers(id);
          let left = Number.POSITIVE_INFINITY;
          let right = Number.NEGATIVE_INFINITY;
          for (const m of ms) {
            const x = xMap.get(m);
            left = Math.min(left, x);
            right = Math.max(right, x + this.nodeWidth);
          }
          if (!Number.isFinite(left)) left = 0;
          if (!Number.isFinite(right)) right = left + this.nodeWidth;
          return { left, right };
        };
        // 仅移动“父母行(本人+spouse)”，不动孩子
        const shiftCluster = (id: string, dx: number) => {
          if (dx === 0) return;
          for (const m of getClusterMembers(id)) {
            xMap.set(m, xMap.get(m)! + dx);
          }
        };
        // 整体移动：移动“某个孩子子树”(孩子 + 后代 + 各自 spouse 行)
        const shiftSubtree = (rootId: string, dx: number) => {
          if (dx === 0) return;
          const stack = [rootId];
          const seen = new Set<string>();
          while (stack.length) {
            const cur = stack.pop()!;
            if (seen.has(cur)) continue;
            seen.add(cur);

            // cur 的 cluster 一起移动
            for (const m of getClusterMembers(cur)) {
              xMap.set(m, xMap.get(m)! + dx);
            }

            const gn = nodesMap.get(cur);
            if (!gn) continue;
            for (const c of gn.children) {
              stack.push(c);
            }
          }
        };
        // span 缓存：每个节点子树(含 spouse)的左右边界
        const span = new Map<string, { left: number; right: number }>();
        const visiting = new Set<string>();

        const childrenInFamily = (id: string) => {
          const ordered = childrenOrderByParent.get(id) ?? [];
          return ordered;
        };
        // 后序：先算孩子 span，再算自己 span；同时做：
        // 1) 兄弟子树去重叠(需要时 shiftSubtree)
        // 2) 父母 cluster 居中到所有孩子整体中心(shiftCluster)
        const post = (id: string) => {
          if (span.has(id)) return;
          if (visiting.has(id)) {
            // 环保护：退化为当前 cluster 的 span
            const lr = clusterLeftRight(id);
            span.set(id, lr);
            return;
          }
          visiting.add(id);

          const kids = childrenInFamily(id);
          for (const c of kids) post(c);

          if (kids.length === 0) {
            span.set(id, clusterLeftRight(id));
            visiting.delete(id);
            return;
          }

          // --- (A) 兄弟子树从左到右去重叠：不足则整体右移右侧子树 ---
          const orderedKids = kids;

          let prevRight = Number.NEGATIVE_INFINITY;
          for (const c of orderedKids) {
            const s = span.get(c) ?? clusterLeftRight(c);
            const needLeft =
              prevRight === Number.NEGATIVE_INFINITY
                ? s.left
                : prevRight + this.xGap;

            if (s.left < needLeft) {
              const dx = needLeft - s.left;
              shiftSubtree(c, dx);

              // 更新这个子树 span（整体平移）
              span.set(c, { left: s.left + dx, right: s.right + dx });
            }

            const s2 = span.get(c)!;
            prevRight = s2.right;
          }

          // --- (A2) 兄弟子树左压缩：把“空白”拉回去（不会破坏排序） ---
          prevRight = Number.NEGATIVE_INFINITY;
          for (const c of orderedKids) {
            const s = span.get(c) ?? clusterLeftRight(c);

            const targetLeft =
              prevRight === Number.NEGATIVE_INFINITY
                ? s.left
                : prevRight + this.xGap;

            // 如果当前子树 left 比目标更靠右，说明中间有空白 -> 往左拉（dx 为负数）
            if (s.left > targetLeft) {
              const dx = targetLeft - s.left; // negative
              shiftSubtree(c, dx);
              span.set(c, { left: s.left + dx, right: s.right + dx });
            }

            const s2 = span.get(c)!;
            prevRight = s2.right;
          }

          // 重新算孩子整体 span（用最新的）
          const childLeft = Math.min(
            ...orderedKids.map((c) => span.get(c)!.left),
          );
          const childRight = Math.max(
            ...orderedKids.map((c) => span.get(c)!.right),
          );
          const childCenter = (childLeft + childRight) / 2;

          // --- (B) 父母(含 spouse 行)居中到孩子整体中心 ---
          const my = clusterLeftRight(id);
          const myCenter = (my.left + my.right) / 2;
          const dxToCenter = childCenter - myCenter;
          shiftCluster(id, dxToCenter);

          // 更新自己的 span（父母可能被移动）
          const my2 = clusterLeftRight(id);
          span.set(id, {
            left: Math.min(my2.left, childLeft),
            right: Math.max(my2.right, childRight),
          });

          visiting.delete(id);
        };

        for (const r of orderedRoots) post(r);
      }; // end adjustFamilyCentering
      //#endregion

      // 从 root 开始排
      const orderedRoots = [...roots].sort((a, b) =>
        this.compareSiblingMember(
          nodesMap.get(a)?.member,
          nodesMap.get(b)?.member,
        ),
      );
      for (const r of orderedRoots) {
        dfs(r, 0);
      }

      // adjust family centering
      adjustFamilyCentering(orderedRoots, childrenOrderByParent);

      // 写回位置
      for (const id of familyIds) {
        const n = nodesMap.get(id);
        if (!n) continue;
        const x = xMap.get(id);
        const y = yMap.get(id);
        if (x === undefined || y === undefined) continue;
        n.member.position_x = x;
        n.member.position_y = y;
      }
    } // end for family components

    // adjust distance between families
    let globalOffsetX = 0;
    const shiftComponent = (familyIds: string[], dx: number) => {
      if (dx === 0) return;
      for (const id of familyIds) {
        const n = nodesMap.get(id)?.member;
        if (!n) continue;

        const nx = (n.position_x ?? 0) + dx;
        n.position_x = nx;
      }
    };

    const getComponentBounds = (familyIds: string[]) => {
      let minX = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;

      for (const id of familyIds) {
        const n = nodesMap.get(id)?.member;
        if (!n) continue;
        const x = n.position_x ?? 0;
        const y = n.position_y ?? 0;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x + this.nodeWidth);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y + this.nodeHeight);
      }

      if (!Number.isFinite(minX)) minX = 0;
      if (!Number.isFinite(maxX)) maxX = 0;
      if (!Number.isFinite(minY)) minY = 0;
      if (!Number.isFinite(maxY)) maxY = 0;

      return {
        minX,
        maxX,
        minY,
        maxY,
        width: maxX - minX,
        height: maxY - minY,
      };
    };

    for (const familyIds of components) {
      const bounds = getComponentBounds(familyIds);

      const dx = globalOffsetX - bounds.minX;
      shiftComponent(familyIds, dx);

      globalOffsetX += bounds.width + this.xGap * 4;
    }

    // update nodes
    for (let i = 0; i < nodes.length; i++) {
      const n = nodesMap.get(nodes[i].id);
      if (!n) continue;
      nodes[i].data = n.member;
      nodes[i].position = {
        x: n.member.position_x ?? 0,
        y: n.member.position_y ?? 0,
      };
    }
    return { nodes: nodes, edges: edges };
  }

  protected compareSiblingMember(m1: Member, m2: Member) {
    if (!m1 || !m2) {
      return m1.id.localeCompare(m2.id);
    }
    const s1 = m1.sort_order ?? Number.POSITIVE_INFINITY;
    const s2 = m2.sort_order ?? Number.POSITIVE_INFINITY;
    if (s1 > 0 && s2 > 0 && s1 !== s2) return s1 - s2;
    const birth_date1 = m1.birth_date;
    const birth_date2 = m2.birth_date;
    if (birth_date1 && birth_date2 && birth_date1 !== birth_date2)
      return new Date(birth_date1).getTime() - new Date(birth_date2).getTime();
    const create1 = m1.created_at ?? "";
    const create2 = m2.created_at ?? "";
    if (create1 !== create2) return create1.localeCompare(create2);
    return m1.id.localeCompare(m2.id);
  }

  protected computeLevelForFamily(
    componentIds: string[],
    nodesMap: Map<string, MyGraphNode>,
  ) {
    // Initialize levels
    const levels = new Map<string, number>();
    for (const id of componentIds) {
      levels.set(id, -1);
    }

    // Find roots
    // 1. No parents and no spouse in family is root
    // 2. No parents but has spouses in family, and his/her spouse has parents, is not root
    // 3. No parents but has spouses in family, and his/her spouse has no parents, male is root famale is not root
    const roots = componentIds.filter((id) => {
      const gn = nodesMap.get(id);
      if (!gn) return true;
      const haseParents = gn.parents.size > 0;
      const hasSpouse = gn.spouses.size > 0;
      const hasSpouseHasParents = Array.from(gn.spouses).some((sp) => {
        const spNode = nodesMap.get(sp);
        return spNode ? spNode.parents.size > 0 : false;
      });
      if (haseParents) return false;
      // no parents
      if (!hasSpouse) return true;
      if (hasSpouseHasParents) return false;
      // no parents, has spouse, spouse has no parents
      return gn.member.gender === "male";
    });

    // BFS to assign levels
    const queue: string[] = [...roots];
    for (const id of queue) {
      levels.set(id, 0);
    }
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const currLevel = levels.get(curr)!;
      const gn = nodesMap.get(curr);
      if (!gn) continue;
      for (const ch of gn.children) {
        const existingLevel = levels.get(ch);
        if (existingLevel === undefined || existingLevel === -1) {
          levels.set(ch, currLevel + 1);
          queue.push(ch);
        }
      }
      for (const sp of gn.spouses) {
        const existingLevel = levels.get(sp);
        if (existingLevel === undefined || existingLevel === -1) {
          levels.set(sp, currLevel);
          queue.push(sp);
        }
      }
    }

    return { levels, roots };
  }

  protected splitFamilyComponents(nodesMap: Map<string, MyGraphNode>) {
    const adj = new Map<string, Set<string>>();
    const ensureAdj = (id: string) => {
      if (!adj.has(id)) adj.set(id, new Set<string>());
      return adj.get(id)!;
    };
    for (const [id, gn] of nodesMap) {
      const neighbors = ensureAdj(id);
      for (const sp of gn.spouses) {
        neighbors.add(sp);
        ensureAdj(sp).add(id);
      }
      for (const ch of gn.children) {
        neighbors.add(ch);
        ensureAdj(ch).add(id);
      }
      for (const pa of gn.parents) {
        neighbors.add(pa);
        ensureAdj(pa).add(id);
      }
    }

    const components: string[][] = [];
    const visited = new Set<string>();
    for (const startId of nodesMap.keys()) {
      if (visited.has(startId)) continue;
      // BFS/DFS to find component
      const stack = [startId];
      const comp: string[] = [];
      visited.add(startId);
      while (stack.length > 0) {
        const curr = stack.pop()!;
        comp.push(curr);
        for (const neighbor of ensureAdj(curr)) {
          if (visited.has(neighbor)) continue;
          visited.add(neighbor);
          stack.push(neighbor);
        }
      }
      components.push(comp);
    }
    return components;
  }

  protected buildDriectedGraph(nodes: Node<Member>[], edges: Edge[]) {
    const nodesMap = new Map<string, MyGraphNode>();
    for (const n of nodes) {
      nodesMap.set(n.id, {
        id: n.id,
        member: n.data,
        spouses: new Set<string>(),
        children: new Set<string>(),
        parents: new Set<string>(),
      });
    }
    for (const e of edges) {
      const sourceNode = nodesMap.get(e.source);
      const targetNode = nodesMap.get(e.target);
      if (!sourceNode || !targetNode) continue;
      if (e.data.type === "spouse") {
        sourceNode.spouses.add(e.target);
        targetNode.spouses.add(e.source);
      } else if (e.data.type === "parent-child") {
        sourceNode.children.add(e.target);
        targetNode.parents.add(e.source);
      }
    }
    return nodesMap;
  }
}

export class NormalLayoutStrategy extends RecursiveFamilyLayoutStrategy {
  /**
   *
   */
  constructor() {
    const nodeWidth = getNodeWidth();
    const nodeHeight = getNodeHeight();
    super(nodeWidth, nodeHeight);
    this.xGap = 50;
    this.spouseGap = 30;
    this.spouseStep = 100;
    this.yGap = 50;
  }
}

export class CompactLayoutStrategy extends RecursiveFamilyLayoutStrategy {
  /**
   *
   */
  constructor() {
    const nodeWidth = getCompactNodeWidth();
    const nodeHeight = getCompactNodeHeight();
    super(nodeWidth, nodeHeight);
    this.xGap = 40;
    this.spouseGap = 20;
    this.spouseStep = 40;
    this.yGap = 50;
  }
}
