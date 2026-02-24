import { Region, Member } from "@/types";
import { Node } from "reactflow";
import {
  getCompactNodeHeight,
  getCompactNodeWidth,
  getNodeHeight,
  getNodeWidth,
} from "@/config/constants";

/**
 * Calculates region nodes based on member positions.
 * @param memberNodes The list of member nodes with their current positions.
 * @param regions The list of region definitions.
 * @param compactMode Whether compact mode is enabled.
 * @returns An array of region nodes.
 */
export function calculateRegionNodes(
  memberNodes: Node[],
  regions: Region[],
  compactMode: boolean
): Node[] {
  const regionNodes: Node[] = [];

  if (!regions || regions.length === 0) {
    return regionNodes;
  }

  const nodeW = compactMode ? getCompactNodeWidth() : getNodeWidth();
  const nodeH = compactMode ? getCompactNodeHeight() : getNodeHeight();
  const padding = 20;

  regions.forEach((region) => {
    const membersInRegion = memberNodes.filter((n) => {
      const m = n.data as Member;
      return m.region_ids?.includes(region.id);
    });

    if (membersInRegion.length > 0) {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

      membersInRegion.forEach((n) => {
        // ReactFlow position is top-left
        if (n.position.x < minX) minX = n.position.x;
        if (n.position.y < minY) minY = n.position.y;
        if (n.position.x + nodeW > maxX) maxX = n.position.x + nodeW;
        if (n.position.y + nodeH > maxY) maxY = n.position.y + nodeH;
      });

      const regionWidth = maxX - minX + padding * 2;
      const regionHeight = maxY - minY + padding * 2;

      regionNodes.push({
        id: `region-${region.id}`,
        type: "region",
        position: { x: minX - padding, y: minY - padding },
        data: {
          label: region.name,
          description: region.description,
          color: region.color,
          width: regionWidth,
          height: regionHeight,
          originalRegion: region,
        },
        draggable: false,
        selectable: true,
        zIndex: -1,
        style: { zIndex: -1, width: regionWidth, height: regionHeight },
      });
    }
  });

  return regionNodes;
}
