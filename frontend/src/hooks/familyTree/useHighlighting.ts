import { useSettings } from "@/hooks/useSettings";
import { SettingsState } from "@/store/settingsSlice";
import { useCallback } from "react";
import { Edge, Node } from "reactflow";

/** Compute focus/highlight styling (pure function) */
function applyHighlightPure(
  currentNodes: Node[],
  currentEdges: Edge[],
  selectedNIds: string[] | undefined,
  selectedEId: string | null,
  settings: SettingsState,
) {
  const safeSelectedNIds = selectedNIds || [];
  const { focusModeEnabled, focusRelations } = settings;

  // No selection OR focus off -> reset opacity
  if ((safeSelectedNIds.length === 0 && !selectedEId) || !focusModeEnabled) {
    return {
      nodes: currentNodes.map((n) => ({
        ...n,
        zIndex: (n.data as any)?.baseZIndex ?? n.zIndex,
        // Sync 'selected' state
        selected: safeSelectedNIds.includes(n.id),
        style: { ...n.style, opacity: 1 },
      })),
      edges: currentEdges.map((e) => ({
        ...e,
        selected: e.id === selectedEId,
        style: { ...e.style, opacity: 1 },
      })),
    };
  }

  const relevantNodeIds = new Set<string>();

  safeSelectedNIds.forEach((selectedNId) => {
    relevantNodeIds.add(selectedNId);

    // Parents
    currentEdges
      .filter(
        (e) => e.target === selectedNId && e.data?.type === "parent-child",
      )
      .forEach((e) => {
        const parentNode = currentNodes.find((n) => n.id === e.source);
        if (!parentNode) return;
        const gender = parentNode.data?.gender;
        if (gender === "male" && focusRelations.father)
          relevantNodeIds.add(e.source);
        if (gender === "female" && focusRelations.mother)
          relevantNodeIds.add(e.source);
        if (!gender && (focusRelations.father || focusRelations.mother))
          relevantNodeIds.add(e.source);
      });

    // Spouses
    if (focusRelations.spouse) {
      currentEdges
        .filter(
          (e) =>
            (e.source === selectedNId || e.target === selectedNId) &&
            e.data?.type === "spouse",
        )
        .forEach((e) =>
          relevantNodeIds.add(e.source === selectedNId ? e.target : e.source),
        );
    }

    // Children
    currentEdges
      .filter(
        (e) => e.source === selectedNId && e.data?.type === "parent-child",
      )
      .forEach((e) => {
        const childNode = currentNodes.find((n) => n.id === e.target);
        if (!childNode) return;
        const gender = childNode.data?.gender;
        if (gender === "male" && focusRelations.son)
          relevantNodeIds.add(e.target);
        if (gender === "female" && focusRelations.daughter)
          relevantNodeIds.add(e.target);
        if (!gender && (focusRelations.son || focusRelations.daughter))
          relevantNodeIds.add(e.target);
      });
  });

  // Edge selected -> ensure its endpoints are relevant
  if (selectedEId) {
    const edge = currentEdges.find((e) => e.id === selectedEId);
    if (edge) {
      relevantNodeIds.add(edge.source);
      relevantNodeIds.add(edge.target);
    }
  }

  const newNodes = currentNodes.map((node) => ({
    ...node,
    // Restore base zIndex if not overridden by selection or hover logic in Canvas
    // However, canvas logic is imperative via setNodes. 
    // This pure function returns NEW objects.
    // We must preserve zIndex from 'node' if it exists.
    zIndex: (node.data as any)?.baseZIndex ?? node.zIndex, 
    selected: safeSelectedNIds.includes(node.id),
    style: {
      ...node.style,
      opacity: relevantNodeIds.has(node.id) ? 1 : 0.1,
    },
  }));

  const newEdges = currentEdges.map((edge) => {
    let isRelevant = false;
    if (selectedEId) {
      isRelevant = edge.id === selectedEId;
    } else if (safeSelectedNIds.length > 0) {
      isRelevant =
        relevantNodeIds.has(edge.source) && relevantNodeIds.has(edge.target);
    }

    return {
      ...edge,
      selected: edge.id === selectedEId,
      style: {
        ...edge.style,
        opacity: isRelevant ? 1 : 0.1,
      },
    };
  });

  return { nodes: newNodes, edges: newEdges };
}

export function useHighlighting() {
  const { state: settings } = useSettings();

  const applyHighlight = useCallback((
    nodes: Node[],
    edges: Edge[],
    selectedNodeIds: string[],
    selectedEdgeId: string | null
  ) => {
    return applyHighlightPure(
      nodes,
      edges,
      selectedNodeIds,
      selectedEdgeId,
      settings
    );
  }, [settings]);

  return { applyHighlight, settings };
}
