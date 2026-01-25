import { getNodeWidth, getNodeHeight } from '@/config/constants';
import { Edge, Node } from 'reactflow';
import { LayoutStrategy } from './LayoutStrategy';

interface GraphNode {
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
    // Layout helpers
    visited: boolean;
    treeX: number; // relative X in subtree
    finalX: number;
    modifier: number; // for Reingold-Tilford shifting
}

export class RecursiveFamilyLayoutStrategy implements LayoutStrategy {
    private nodesMap: Map<string, GraphNode> = new Map();
    private nodeWidth = getNodeWidth();
    private nodeHeight = getNodeHeight(); 
    private xGap = 50; // Gap between families (siblings)
    private spouseGap = 50; // Gap between husband and wives block
    private spouseOverlap = 210; 
    private spouseStep = 100; 
    private yGap = 200; // Keep this large enough for edges
    private globalX = 0;

    layout(nodes: Node[], edges: Edge[]): { nodes: Node[], edges: Edge[] } {
        this.nodesMap.clear();
        this.globalX = 0;

        // 1. Initialize GraphNodes
        nodes.forEach(n => {
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
                visited: false,
                treeX: 0,
                finalX: 0,
                modifier: 0
            });
        });

        // 2. Build Relationships
        edges.forEach(e => {
            const source = this.nodesMap.get(e.source);
            const target = this.nodesMap.get(e.target);
            if (!source || !target) return;

            if (e.data?.type === 'spouse' || e.type === 'spouse') {
                if (!source.spouses.includes(target.id)) source.spouses.push(target.id);
                if (!target.spouses.includes(source.id)) target.spouses.push(source.id);
            } else {
                // Parent -> Child
                if (!source.children.includes(target.id)) source.children.push(target.id);
                if (!target.parents.includes(source.id)) target.parents.push(source.id);
            }
        });

        // 3. Find Roots (No parents)
        // Note: A spouse might have no parents recorded, but if their partner has parents, 
        // they are not a "tree root" in the visual sense, they are attached to the partner.
        // We should prioritize nodes that are "bloodline" roots if possible, or just any node with no parents.
        // Better definition of root for visualization: No parents.
        const roots = Array.from(this.nodesMap.values()).filter(n => n.parents.length === 0);

        // However, if A and B are spouses and both have no parents, we should pick one as primary to start layout,
        // and the other will be handled as spouse.
        // We need to filter roots to avoid double-processing spouses.
        const processedRoots = new Set<string>();
        const finalRoots: GraphNode[] = [];

        roots.forEach(root => {
            if (processedRoots.has(root.id)) return;
            
            // If this root has a spouse who is also a root, decide who is "primary"
            // For simplicity, pick the one with more children, or alphabetical ID
            // Actually, just pick current one and mark spouse as processed.
            finalRoots.push(root);
            processedRoots.add(root.id);
            root.spouses.forEach(sId => {
                if (roots.find(r => r.id === sId)) {
                    processedRoots.add(sId);
                }
            });
        });

        // 4. Perform Layout for each root (forest support)
        
        finalRoots.forEach(root => {
            this.calculateLevel(root, 0);
            this.layoutTree(root);
            
            // Shift the whole tree to currentForestX
            // (Simplification: layoutTree uses globalX, so we might not need explicit shifting if globalX increments)
            // But layoutTree (DFS) assigns X based on children.
            // Let's rely on a recursive "place leaves then center parents" approach.
        });

        // 5. Map back to ReactFlow nodes
        const layoutedNodes = nodes.map(node => {
            const gNode = this.nodesMap.get(node.id);
            if (gNode) {
                node.position = {
                    x: gNode.x,
                    y: gNode.y
                };
            }
            return node;
        });

        return { nodes: layoutedNodes, edges };
    }

    private calculateLevel(node: GraphNode, level: number) {
        if (node.level < level) node.level = level; // Max level wins (if multiple paths)
        // Spouses are on same level
        node.spouses.forEach(sId => {
            const spouse = this.nodesMap.get(sId);
            if (spouse && spouse.level < level) {
                spouse.level = level;
                // Don't recurse into spouse's children here to avoid double counting if they share children?
                // Actually we should.
            }
        });

        node.children.forEach(cId => {
            const child = this.nodesMap.get(cId);
            if (child) {
                this.calculateLevel(child, level + 1);
            }
        });
    }

    // A simple recursive layout:
    // Returns the center X of the subtree rooted at 'node' (including its spouses)
    private layoutTree(node: GraphNode): number {
        if (node.visited) return node.x + node.width/2; // Should not happen in tree, but DAG yes.
        node.visited = true;

        // Identify the "Family Unit" (Node + Spouses)
        const familyMembers = [node];
        node.spouses.forEach(sId => {
            const s = this.nodesMap.get(sId);
            if (s && !s.visited) {
                s.visited = true;
                familyMembers.push(s);
            }
        });

        // Collect all children of this family unit
        // We need to deduplicate children (since both parents link to same child)
        const childrenIds = new Set<string>();
        familyMembers.forEach(m => m.children.forEach(c => childrenIds.add(c)));
        const children = Array.from(childrenIds).map(id => this.nodesMap.get(id)!).filter(c => c !== undefined);

        // Sort children? By age (if birthdate avail) or id. 
        // For now keep order.

        let subtreeCenterX = 0;
        
        // Calculate visual width of family unit (overlapping spouses)
        // Main Node Width + Spouse Gap + (Spouse Count > 0 ? (Spouse Width + (Spouse Count - 1) * Step) : 0)
        let familyVisualWidth = this.nodeWidth;
        if (familyMembers.length > 1) {
            const spouseCount = familyMembers.length - 1;
            // Width of spouses stack = Width + (N-1)*Step
            const spousesStackWidth = this.nodeWidth + (spouseCount - 1) * this.spouseStep;
            familyVisualWidth += this.spouseGap + spousesStackWidth;
        }

        if (children.length === 0) {
            // Leaf family
            const startX = this.globalX;
            
            this.placeFamily(familyMembers, startX, node.level);
            
            this.globalX += familyVisualWidth + this.xGap; // Advance global pointer
            
            // Subtree Center is Main Node Center
            subtreeCenterX = startX + this.nodeWidth / 2;
        } else {
            // Inner node
            // 1. Capture the start X limit for children (right edge of previous sibling)
            // But this.globalX tracks the rightmost edge of EVERYTHING so far.
            // If we are processing children, they will start at this.globalX.
            // So we need to remember where our children *could* start (which is current globalX).
            // Actually, we just need to ensure our placement doesn't overlap the left neighbor.
            const minStartX = this.globalX;

            // 1. Layout all children first
            const childCenters: number[] = [];
            children.forEach(child => {
                // If child already visited (e.g. multi-parent from outside this unit?), skip?
                // In strict tree, no. In DAG, yes. 
                // If child is visited, we can't move it. Just use its position.
                if (child.visited) {
                     childCenters.push(child.x + child.width / 2);
                } else {
                     childCenters.push(this.layoutTree(child));
                }
            });

            // 2. Determine Center X based on children
            if (childCenters.length > 0) {
                // Special case: Single child
                const firstChildCenter = childCenters[0];
                const lastChildCenter = childCenters[childCenters.length - 1];
                
                // Normal centering
                subtreeCenterX = (firstChildCenter + lastChildCenter) / 2;
                
                // If single child, parent should just align with child?
                // The user complains about "leaning left".
                // This happens if parent is WIDE (e.g. 500px) and child is NARROW (256px).
                // subtreeCenterX aligns center-to-center.
                // startX = center - parentWidth/2.
                // If child is at 1000, parent center is 1000.
                // Parent starts at 1000 - 250 = 750.
                // This looks "centered".
                
                // BUT, if the "family unit" (Main + Spouses) is visually unbalanced?
                // E.g. [Husband]----[Wife1][Wife2]...
                // The visual center of this block is in the middle of the whole block.
                // If we align this visual center to the child's center, the "Husband" (Main Node)
                // might be far to the left of the child.
                // Maybe the user wants the HUSBAND (bloodline) to align with the child?
                
                // Let's try aligning the Main Node (members[0]) to the child center, 
                // rather than the whole family block center.
                // Family Block: [MainNode (Width)] + [Gap] + [Spouses (StackWidth)]
                // MainNode Center relative to StartX is: Width/2.
                // Whole Block Center relative to StartX is: TotalWidth/2.
                
                // If we align MainNode Center to Child Center:
                // MainNodeCenterX = ChildCenter
                // StartX + Width/2 = ChildCenter
                // StartX = ChildCenter - Width/2
                
                // Let's try this alignment strategy for single-child (or even multi-child) cases.
                // It usually looks better if the "Bloodline" flows straight down.
                
                // However, if we do this, the Spouses will hang to the right.
                // We must ensure we don't overlap right neighbors (globalX doesn't track right neighbor start).
                // But globalX is updated by US at the end, so next sibling will respect our right edge.
                
                // So, let's change alignment: Align Main Node Center to Subtree Center.
                
                // Calculate offset to align Main Node
                // StartX should be such that: StartX + this.nodeWidth/2 = subtreeCenterX
                
                // Wait, if we do this, and we have many spouses, the spouses extend far right.
                // Is that what user wants? "Don't extend left/right unnecessarily".
                // If we align whole block center, we extend left AND right.
                // If we align Main Node, we extend only Right (spouses).
                // But if we extend left (standard centering), we might hit globalX (left neighbor).
                // And our "shift right if hit globalX" logic handles that.
                
                // The user says "Layout consistently leans left". 
                // This implies that for a single line (A -> B -> C), the visual path moves to the left?
                // Or maybe the whole tree drifts?
                
                // If I have [Husband][Wife], total width ~500. Center is between them.
                // Child [Son]. Center is Son.
                // Align: Son is below the gap between Husband and Wife.
                // Visually:
                // [Husband] [Wife]
                //      [Son]
                // The line form Husband to Son goes diagonal right-down.
                // User probably wants:
                // [Husband] [Wife]
                // [Son]
                // (Husband directly above Son).
                
                // Yes, aligning Main Node to Child Center seems to be the key for "Straight Bloodline".
                
                // Let's modify:
                // We want MainNode's Center to align with subtreeCenterX.
                // MainNode is at startX.
                // So startX = subtreeCenterX - this.nodeWidth/2.
                
                // BUT, we still need to respect familyVisualWidth for globalX calculation later.
                
                // Let's try this alignment.
                // Note: subtreeCenterX is the center of the CHILDREN.
                
            } else {
                // Should be covered by leaf case, but just in case
                subtreeCenterX = this.globalX + this.nodeWidth / 2;
            }

            // 3. Place Family centered at subtreeCenterX
            // Ensure startX respects globalX
            // OLD: let startX = subtreeCenterX - familyVisualWidth / 2;
            
            // NEW STRATEGY: Align Main Node (Husband) Center with Subtree Center (Children Center)
            // This ensures vertical bloodline flow.
            // MainNodeCenter = StartX + NodeWidth/2
            // We want MainNodeCenter = subtreeCenterX
            // So: StartX = subtreeCenterX - NodeWidth/2
            
            let startX = subtreeCenterX - this.nodeWidth / 2;
            
            // Optimization for single child case:
            // If parent has only 1 child, and parent is wider than child (e.g. has spouses),
            // standard centering might push startX to the left of child's startX, potentially overlapping previous neighbor.
            // But the check below (startX < this.globalX) handles that.
            
            // Important: We should check against minStartX (boundary before children were placed), 
            // not this.globalX (which is now at the right edge of our children).
            // If we check against this.globalX, we force parent to be to the right of its own children!
            
            if (startX < minStartX) {
                startX = minStartX;
                // If we shifted right, we must update subtreeCenterX so parents up the chain know where we are
                subtreeCenterX = startX + this.nodeWidth / 2;
            }

            // Collision check: Ensure we don't overlap with previously placed nodes on the left
            // layoutTree traverses left-to-right via children, so globalX tracks the rightmost edge of the *leaves*.
            // But for higher levels, we might be placing to the left of globalX if children are compact.
            // Actually, strict post-order traversal + globalX for leaves usually ensures separation.
            // But we need to ensure startX >= globalX if this is a new branch?
            // No, startX is determined by children.
            
            // Simple collision fix: if startX < this.globalX (meaning we are overlapping with previous sibling's subtree area?),
            // we should shift? 
            // In standard Reingold-Tilford, we shift subtrees. Here we just accept the position derived from children
            // because children were placed using globalX, so they are definitely to the right of previous stuff.
            // So parent being centered on them is safe *relative to children*.
            
            // What if the parent family is very wide (many spouses) and children are narrow?
            // Then startX might be too far left.
            // We can check if startX < max_x_of_same_level_nodes. 
            // But let's trust the "children center" for now.

            this.placeFamily(familyMembers, startX, node.level);
            
            // Update globalX if we extended beyond it (e.g. wide parents, narrow kids)
            const rightEdge = startX + familyVisualWidth + this.xGap;
            if (rightEdge > this.globalX) {
                this.globalX = rightEdge;
            }
        }

        return subtreeCenterX;
    }

    private placeFamily(members: GraphNode[], startX: number, level: number) {
        // members[0] is the main node (bloodline), others are spouses.
        // We want the main node to be fully visible, and spouses overlapping it or next to it.
        // Wait, user said: "Spouses can overlap, but should NOT overlap with their husband (main node)"
        // So Main Node should stand clear. Spouses can stack on each other.
        
        // Strategy:
        // [Main Node] [Spouse 1] [Spouse 2] [Spouse 3] ...
        // Main Node takes full width.
        // Spouse 1 starts at Main Node Right + Gap.
        // Spouse 2 starts at Spouse 1 + Step (Overlapping).
        
        if (members.length === 0) return;

        const mainNode = members[0];
        mainNode.x = startX;
        mainNode.y = level * this.yGap;

        if (members.length > 1) {
            // Place spouses
            // Start spouses after main node + spouseGap
            const spousesStartX = startX + this.nodeWidth + this.spouseGap;
            
            for (let i = 1; i < members.length; i++) {
                const spouse = members[i];
                // Spouse 1 is at index 0 relative to spouses list
                // Spouse i is at spousesStartX + (i-1) * step
                spouse.x = spousesStartX + (i - 1) * this.spouseStep;
                spouse.y = level * this.yGap;
            }
        }
    }
}
