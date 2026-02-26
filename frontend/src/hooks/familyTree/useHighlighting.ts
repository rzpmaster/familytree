import { useSettings } from "@/hooks/useSettings";
import { getMemberStatus } from "@/lib/utils";
import { SettingsState } from "@/store/settingsSlice";
import { Member } from "@/types";
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
  const {
    focusModeEnabled,
    focusRelations,
    timelineEnabled,
    timelineYear,
    showLiving,
    showNotLiving,
    showDeceased,
    showUnborn,
    showSpouses,
  } = settings;

  const effectiveYear =
    timelineEnabled && timelineYear !== null ? timelineYear : undefined;

  // 1. Identify hidden nodes based on settings
  const hiddenNodeIds = new Set<string>();

  currentNodes.forEach((n) => {
    if (n.type === "member") {
      const member = n.data as Member;
      const status = getMemberStatus(member, effectiveYear);

      if (status === "living") {
        if (!showLiving) hiddenNodeIds.add(n.id);
      } else if (status === "deceased") {
        if (!showNotLiving || !showDeceased) hiddenNodeIds.add(n.id);
      } else if (status === "unborn") {
        if (!showNotLiving || !showUnborn) hiddenNodeIds.add(n.id);
      }

      // Check for spouses (wives) to hide
      if (!showSpouses) {
        const isFemale = member.gender === "female";
        if (isFemale) {
          const hasParent = currentEdges.some(
            (e) => e.target === n.id && e.data?.type === "parent-child",
          );

          if (!hasParent) {
            // Check if has spouse connection
            const hasSpouse = currentEdges.some(
              (e) =>
                (e.source === n.id || e.target === n.id) &&
                e.data?.type === "spouse",
            );

            if (hasSpouse) {
              hiddenNodeIds.add(n.id);
            }
          }
        }
      }
    }
  });

  // No selection OR focus off -> reset opacity (but respect hidden nodes for edges)
  if ((safeSelectedNIds.length === 0 && !selectedEId) || !focusModeEnabled) {
    return {
      nodes: currentNodes.map((n) => {
        const isHidden = hiddenNodeIds.has(n.id);
        return {
          ...n,
          zIndex: n.data?.baseZIndex ?? n.zIndex,
          // Sync 'selected' state
          selected: safeSelectedNIds.includes(n.id),
          style: {
            ...n.style,
            opacity: isHidden ? 0 : 1,
            pointerEvents: (isHidden
              ? "none"
              : "all") as React.CSSProperties["pointerEvents"],
          },
        };
      }),
      edges: currentEdges.map((e) => {
        const isHidden =
          hiddenNodeIds.has(e.source) || hiddenNodeIds.has(e.target);
        return {
          ...e,
          selected: e.id === selectedEId,
          style: {
            ...e.style,
            opacity: isHidden ? 0 : 1,
            pointerEvents: (isHidden
              ? "none"
              : "all") as React.CSSProperties["pointerEvents"],
          },
        };
      }),
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

  const newNodes = currentNodes.map((node) => {
    const isHidden = hiddenNodeIds.has(node.id);
    return {
      ...node,
      // Restore base zIndex if not overridden by selection or hover logic in Canvas
      // However, canvas logic is imperative via setNodes.
      // This pure function returns NEW objects.
      // We must preserve zIndex from 'node' if it exists.
      zIndex: node.data?.baseZIndex ?? node.zIndex,
      selected: safeSelectedNIds.includes(node.id),
      style: {
        ...node.style,
        opacity: isHidden ? 0 : relevantNodeIds.has(node.id) ? 1 : 0.1,
        pointerEvents: (isHidden
          ? "none"
          : "all") as React.CSSProperties["pointerEvents"],
      },
    };
  });

  const newEdges = currentEdges.map((edge) => {
    let isRelevant = false;
    if (selectedEId) {
      isRelevant = edge.id === selectedEId;
    } else if (safeSelectedNIds.length > 0) {
      isRelevant =
        relevantNodeIds.has(edge.source) && relevantNodeIds.has(edge.target);
    }

    const isHidden =
      hiddenNodeIds.has(edge.source) || hiddenNodeIds.has(edge.target);

    return {
      ...edge,
      selected: edge.id === selectedEId,
      style: {
        ...edge.style,
        opacity: isHidden ? 0 : isRelevant ? 1 : 0.1,
        pointerEvents: (isHidden
          ? "none"
          : "all") as React.CSSProperties["pointerEvents"],
      },
    };
  });

  return { nodes: newNodes, edges: newEdges };
}

export function useHighlighting() {
  const { state: settings } = useSettings();

  const applyHighlight = useCallback(
    (
      nodes: Node[],
      edges: Edge[],
      selectedNodeIds: string[],
      selectedEdgeId: string | null,
    ) => {
      return applyHighlightPure(
        nodes,
        edges,
        selectedNodeIds,
        selectedEdgeId,
        settings,
      );
    },
    [settings],
  );

  return { applyHighlight, settings };
}
