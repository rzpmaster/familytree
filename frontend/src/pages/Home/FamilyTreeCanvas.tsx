import FamilyManager from "@/components/FamilyManager";
import { useSettings } from "@/hooks/useSettings";
import { parseDate } from "@/lib/utils";
import {
  createParentChildRelationship,
  createSpouseRelationship,
  getFamilyGraph,
  updateMember,
} from "@/services/api";
import { RootState } from "@/store";
import {
  clearNodeSelection,
  setSelectedNodeIds,
  toggleNodeSelection,
} from "@/store/familySlice";
import { setTimelineYear, SettingsState } from "@/store/settingsSlice";
import {
  CompactLayoutStrategy,
  NormalLayoutStrategy,
} from "@/strategies/layout/RecursiveFamilyLayoutStrategy";
import { Family, GraphEdge, GraphNode, Member } from "@/types";
import { RuleEngine } from "@/validation/RuleEngine";
import {
  ChildBirthPosthumousRule,
  MaxParentsRule,
  ParentAgeRule,
} from "@/validation/rules/parentChildRules";
import {
  LifespanOverlapRule,
  OppositeGenderRule,
} from "@/validation/rules/spouseRules";
import { Focus, Layout, Plus } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import ReactFlow, {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Connection,
  ConnectionMode,
  Controls,
  Edge,
  EdgeChange,
  EdgeTypes,
  Node,
  NodeChange,
  NodeTypes,
  OnConnectStartParams,
  Panel,
  ReactFlowInstance,
  useEdgesState,
  useNodesState,
  Viewport,
} from "reactflow";
import "reactflow/dist/style.css";
import { CustomEdge } from "./CustomEdge";
import MemberNode from "./MemberNode";

const nodeTypes: NodeTypes = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  member: MemberNode as any,
};

const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
};

interface FamilyTreeCanvasProps {
  familyId: string;
  onNodeSelect: (member: Member | null) => void;
  onEdgeSelect?: (edge: GraphEdge | null) => void;
  onAddMember?: (position: { x: number; y: number }) => void;
  refreshTrigger?: number;
  readOnly?: boolean;
  // FamilyManager props
  families: Family[];
  currentFamily: Family | null;
  onSelectFamily: (family: Family) => void;
  onFamilyCreated: () => void;
}

/** Normalize selection against current graph */
function normalizeSelection(
  flowNodes: Node[],
  flowEdges: Edge[],
  selectedNodeIds: string[],
  selectedEdgeId: string | null,
) {
  // English: keep only ids that still exist
  const nodeIdSet = new Set(flowNodes.map((n) => n.id));
  const edgeIdSet = new Set(flowEdges.map((e) => e.id));

  const validSelectedNodeIds = selectedNodeIds.filter((id) =>
    nodeIdSet.has(id),
  );
  const validSelectedEdgeId =
    selectedEdgeId && edgeIdSet.has(selectedEdgeId) ? selectedEdgeId : null;

  return { validSelectedNodeIds, validSelectedEdgeId };
}

/** Compute focus/highlight styling (pure function) */
function applyHighlightPure(
  currentNodes: Node[],
  currentEdges: Edge[],
  selectedNIds: string[],
  selectedEId: string | null,
  settings: SettingsState,
) {
  const { focusModeEnabled, focusRelations } = settings;
  // no selection OR focus off -> reset opacity
  if ((selectedNIds.length === 0 && !selectedEId) || !focusModeEnabled) {
    return {
      nodes: currentNodes.map((n) => ({
        ...n,
        selected: selectedNIds.includes(n.id),
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

  selectedNIds.forEach((selectedNId) => {
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
    selected: selectedNIds.includes(node.id),
    style: {
      ...node.style,
      opacity: relevantNodeIds.has(node.id) ? 1 : 0.1,
    },
  }));

  const newEdges = currentEdges.map((edge) => {
    let isRelevant = false;
    if (selectedEId) {
      isRelevant = edge.id === selectedEId;
    } else if (selectedNIds.length > 0) {
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

/* =========================
   Component
   ========================= */

const FamilyTreeCanvas: React.FC<FamilyTreeCanvasProps> = ({
  familyId,
  onNodeSelect,
  onEdgeSelect,
  onAddMember,
  refreshTrigger = 0,
  readOnly = false,
  families,
  currentFamily,
  onSelectFamily,
  onFamilyCreated,
}) => {
  const { t } = useTranslation();
  const { state } = useSettings();
  const settingsRef = useRef<SettingsState>(state);
  const dispatch = useDispatch();

  const selectedNodeIds = useSelector(
    (s: RootState) => s.family.selectedNodeIds,
  );

  const [nodes, setNodes, onNodesChangeBase] = useNodesState([]);
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const hasFittedView = useRef<string | null>(null);

  // Timeline state
  const [yearRange, setYearRange] = useState<{ min: number; max: number }>({
    min: 1900,
    max: new Date().getFullYear(),
  });

  // keep latest nodes/edges for stable callbacks
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  useEffect(() => void (nodesRef.current = nodes), [nodes]);
  useEffect(() => void (edgesRef.current = edges), [edges]);

  // Refs for custom connection logic
  const connectionStartRef = useRef<{
    nodeId: string | null;
    handleId: string | null;
    handleType: string | null;
  } | null>(null);
  const connectionProcessedRef = useRef(false);

  const updateSelectionAndStyles = useCallback(
    (nIds: string[], eId: string | null) => {
      setSelectedEdgeId(eId);

      const currentNodes = nodesRef.current;
      const currentEdges = edgesRef.current;

      const { nodes: styledNodes, edges: styledEdges } = applyHighlightPure(
        currentNodes,
        currentEdges,
        nIds,
        eId,
        settingsRef.current,
      );

      // set as arrays (not functional) to avoid stale cross-dependency
      setNodes(styledNodes);
      setEdges(styledEdges);
    },
    [setNodes, setEdges],
  );

  // Sync settings ref + reapply focus styles
  useEffect(() => {
    settingsRef.current = state;
    updateSelectionAndStyles(selectedNodeIds, selectedEdgeId);
  }, [
    selectedEdgeId,
    selectedNodeIds,
    state,
    state.focusModeEnabled,
    state.focusRelations,
    // Re-apply when these change too
    state.privacyMode,
    state.showDeceased,
    state.timelineEnabled,
    state.timelineYear,
    state.compactMode,
    updateSelectionAndStyles,
  ]);

  const handleAutoLayout = useCallback(async () => {
    const layoutStrategy = state.compactMode
      ? new CompactLayoutStrategy()
      : new NormalLayoutStrategy();

    const { nodes: layoutedNodes, edges: layoutedEdges } =
      layoutStrategy.layout([...nodesRef.current], [...edgesRef.current]);

    setNodes([...layoutedNodes]);
    setEdges([...layoutedEdges]);

    try {
      const promises = layoutedNodes.map((node) =>
        updateMember(node.id, {
          position_x: Math.round(node.position.x),
          position_y: Math.round(node.position.y),
        }),
      );
      await Promise.all(promises);
      toast.success(
        t("family.layout_updated", { defaultValue: "Layout updated" }),
      );
    } catch (e) {
      console.error("Failed to save layout", e);
      toast.error("Failed to save layout");
    }
  }, [setNodes, setEdges, t, state.compactMode]);

  const handleCenterView = useCallback(() => {
    reactFlowInstance.current?.fitView({ duration: 800 });
  }, []);

  const reactFlowWrapperRef = useRef<HTMLDivElement>(null);
  const handleAddMemberClick = useCallback(() => {
    if (!onAddMember) return;
    if (!reactFlowInstance || !reactFlowWrapperRef.current) return;

    // const rect = reactFlowWrapperRef.current.getBoundingClientRect();
    // const clientX = rect.left + rect.width / 2;
    // const clientY = rect.top + rect.height / 2;
    const center = reactFlowInstance.current.project({
      x: 0,
      y: 0,
    });
    onAddMember(center);
  }, [onAddMember]);

  /** Build ReactFlow edges with spouse-handle routing offsets */
  const buildFlowEdges = useCallback(
    (graphNodes: GraphNode[], graphEdges: GraphEdge[]) => {
      const flowEdges: Edge[] = [];
      const nodeHandleEdges: Record<string, string[]> = {};
      const edgeHandles: Record<
        string,
        { sourceHandle: string; targetHandle: string }
      > = {};

      // first pass, decide spouse handles
      graphEdges.forEach((edge) => {
        if (edge.type !== "spouse") return;

        const sourceNode = graphNodes.find((n) => n.id === edge.source);
        const targetNode = graphNodes.find((n) => n.id === edge.target);

        let sourceHandle = "right-source";
        let targetHandle = "left-target";

        if (sourceNode && targetNode) {
          if (sourceNode.x > targetNode.x) {
            sourceHandle = "left-source";
            targetHandle = "right-target";
          } else {
            sourceHandle = "right-source";
            targetHandle = "left-target";
          }
        }

        edgeHandles[edge.id] = { sourceHandle, targetHandle };

        const sourceKey = `${edge.source}-${sourceHandle}`;
        const targetKey = `${edge.target}-${targetHandle}`;

        nodeHandleEdges[sourceKey] = nodeHandleEdges[sourceKey] || [];
        nodeHandleEdges[sourceKey].push(edge.id);

        nodeHandleEdges[targetKey] = nodeHandleEdges[targetKey] || [];
        nodeHandleEdges[targetKey].push(edge.id);
      });

      // second pass, create edges with offsets
      graphEdges.forEach((edge) => {
        let sourceOffsetIndex = 0;
        let targetOffsetIndex = 0;
        let sourceHandle: string | undefined = undefined;
        let targetHandle: string | undefined = undefined;

        if (edge.type === "spouse") {
          const handles = edgeHandles[edge.id];
          if (handles) {
            sourceHandle = handles.sourceHandle;
            targetHandle = handles.targetHandle;

            const sourceKey = `${edge.source}-${sourceHandle}`;
            const targetKey = `${edge.target}-${targetHandle}`;

            const sourceList = nodeHandleEdges[sourceKey] || [];
            const targetList = nodeHandleEdges[targetKey] || [];

            const sourceIdx = sourceList.indexOf(edge.id);
            const targetIdx = targetList.indexOf(edge.id);

            if (sourceIdx !== -1)
              sourceOffsetIndex = sourceIdx - (sourceList.length - 1) / 2;
            if (targetIdx !== -1)
              targetOffsetIndex = targetIdx - (targetList.length - 1) / 2;
          }
        }

        flowEdges.push({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle,
          targetHandle,
          label: edge.label
            ? t(edge.label)
            : edge.type === "spouse"
              ? t("relation.spouse")
              : "",
          type: "custom",
          animated: false,
          style: {
            stroke: edge.type === "spouse" ? "#ff0072" : "#000",
            strokeWidth: 2,
          },
          data: {
            type: edge.type,
            sourceOffsetIndex,
            targetOffsetIndex,
          },
        });
      });

      return flowEdges;
    },
    [t],
  );

  const fetchData = useCallback(async () => {
    try {
      const graphData = await getFamilyGraph(familyId);

      const flowNodes: Node[] = graphData.nodes.map((node: GraphNode) => ({
        id: node.id,
        type: "member",
        position: { x: node.x, y: node.y },
        data: node.data,
      }));

      // Calculate Year Range
      let minY = 1900;
      let maxY = new Date().getFullYear();
      const years = flowNodes
        .map((n) => {
          const d = n.data as Member;
          const y1 = d.birth_date
            ? parseDate(d.birth_date).getFullYear()
            : null;
          const y2 = d.death_date
            ? parseDate(d.death_date).getFullYear()
            : null;
          return [y1, y2];
        })
        .flat()
        .filter((y): y is number => y !== null && !isNaN(y));

      if (years.length > 0) {
        minY = Math.min(...years) - 10;
        maxY = Math.max(...years) + 10;
        setYearRange({ min: minY, max: maxY });
      }

      const flowEdges: Edge[] = buildFlowEdges(
        graphData.nodes,
        graphData.edges,
      );

      const { validSelectedNodeIds, validSelectedEdgeId } = normalizeSelection(
        flowNodes,
        flowEdges,
        selectedNodeIds,
        selectedEdgeId,
      );

      const { nodes: highlightedNodes, edges: highlightedEdges } =
        applyHighlightPure(
          flowNodes,
          flowEdges,
          validSelectedNodeIds,
          validSelectedEdgeId,
          settingsRef.current,
        );

      setNodes(highlightedNodes);
      setEdges(highlightedEdges);

      // Fit view / restore viewport
      const hadNoNodesBefore = nodesRef.current.length === 0;
      if (hadNoNodesBefore && flowNodes.length > 0) {
        if (hasFittedView.current !== familyId) {
          hasFittedView.current = familyId;
          const savedViewport = localStorage.getItem(`viewport-${familyId}`);
          if (savedViewport) {
            const viewport = JSON.parse(savedViewport) as Viewport;
            setTimeout(
              () => reactFlowInstance.current?.setViewport(viewport),
              50,
            );
          } else {
            setTimeout(
              () => reactFlowInstance.current?.fitView({ duration: 800 }),
              100,
            );
          }
        }
      }

      // Keep internal selectedEdgeId consistent if it became invalid
      if (validSelectedEdgeId !== selectedEdgeId) {
        setSelectedEdgeId(validSelectedEdgeId);
      }
    } catch (error) {
      console.error("Failed to fetch graph data", error);
      toast.error("Failed to load family tree");
    }
  }, [
    familyId,
    setNodes,
    setEdges,
    selectedNodeIds,
    selectedEdgeId,
    buildFlowEdges,
  ]);

  useEffect(() => {
    if (familyId) fetchData();
  }, [familyId, fetchData, refreshTrigger]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (readOnly) {
        const allowed = changes.filter((c) => c.type === "select");
        if (allowed.length) setNodes((nds) => applyNodeChanges(allowed, nds));
        return;
      }
      onNodesChangeBase(changes);
    },
    [onNodesChangeBase, readOnly, setNodes],
  );

  const onNodeDragStop = useCallback(
    async (_event: React.MouseEvent, node: Node) => {
      if (readOnly) return;
      try {
        await updateMember(node.id, {
          position_x: Math.round(node.position.x),
          position_y: Math.round(node.position.y),
        });
      } catch (err) {
        console.error("Failed to update position", err);
        toast.error("Failed to save position");
      }
    },
    [readOnly],
  );

  const onConnectStart = useCallback(
    (_: unknown, params: OnConnectStartParams) => {
      if (readOnly) return;
      connectionStartRef.current = {
        nodeId: params.nodeId,
        handleId: params.handleId,
        handleType: params.handleType,
      };
      connectionProcessedRef.current = false;
    },
    [readOnly],
  );

  const processConnection = useCallback(
    async (targetNodeId: string) => {
      if (!connectionStartRef.current?.nodeId) return;

      const {
        nodeId: sourceNodeId,
        handleId: sourceHandleId,
        handleType: sourceHandleType,
      } = connectionStartRef.current;

      if (sourceNodeId === targetNodeId) return;

      let type: "parent-child" | "spouse" = "parent-child";
      let relType: "father" | "mother" = "father";

      const isSpouse =
        sourceHandleId?.includes("left") || sourceHandleId?.includes("right");

      let finalSourceId = sourceNodeId;
      let finalTargetId = targetNodeId;

      if (isSpouse) {
        type = "spouse";
      } else {
        // English: if started from target handle, reverse direction
        if (sourceHandleType === "target") {
          finalSourceId = targetNodeId;
          finalTargetId = sourceNodeId;
        }
      }

      const sourceNode = nodesRef.current.find((n) => n.id === finalSourceId);
      const targetNode = nodesRef.current.find((n) => n.id === finalTargetId);

      if (!sourceNode || !targetNode) {
        toast.error("Source or Target node not found");
        return;
      }

      const existingEdges: GraphEdge[] = edgesRef.current.map((e: Edge) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: (e.data?.type as any) || (e.type as any) || "custom",
        data: e.data,
      }));

      const allMembers: Member[] = nodesRef.current.map(
        (n) => n.data as Member,
      );

      const validationContext = {
        source: sourceNode.data as Member,
        target: targetNode.data as Member,
        relationshipType: type,
        existingEdges,
        allNodes: allMembers,
      };

      const rules = [
        OppositeGenderRule,
        LifespanOverlapRule,
        ParentAgeRule,
        ChildBirthPosthumousRule,
        MaxParentsRule,
      ];

      const engine = new RuleEngine(rules);
      const validationResult = engine.validate(validationContext);

      if (!validationResult.valid) {
        toast.error(
          validationResult.errorKey
            ? t(validationResult.errorKey)
            : "Validation failed",
        );
        return;
      }

      try {
        if (type === "spouse") {
          await createSpouseRelationship(finalSourceId, finalTargetId);
          toast.success(t("relation.created"));
        } else {
          const gender = (sourceNode.data as Member).gender;
          relType = gender === "female" ? "mother" : "father";

          await createParentChildRelationship(
            finalSourceId,
            finalTargetId,
            relType,
          );
          toast.success(t("relation.created"));
        }
        fetchData();
      } catch (err) {
        console.error("Failed to create relationship", err);
        toast.error(t("relation.create_failed"));
      }
    },
    [fetchData, t],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      connectionProcessedRef.current = true;
      const initiatorId = connectionStartRef.current?.nodeId;
      if (!initiatorId) return;

      const otherNodeId =
        params.source === initiatorId ? params.target : params.source;
      if (otherNodeId) processConnection(otherNodeId);
    },
    [processConnection],
  );

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      if (connectionProcessedRef.current) return;

      const targetNode = (event.target as Element).closest(".react-flow__node");
      if (targetNode) {
        const targetId = targetNode.getAttribute("data-id");
        if (targetId) processConnection(targetId);
      }
    },
    [processConnection],
  );

  const onEdgesChangeIntercepted = useCallback(
    (changes: EdgeChange[]) => {
      if (readOnly) {
        const allowed = changes.filter((c) => c.type === "select");
        if (allowed.length) {
          setEdges((eds) => applyEdgeChanges(allowed, eds));
        }
        return;
      }

      const changesToApply = changes.filter((c) => {
        if (c.type === "remove") {
          const edge = edgesRef.current.find((e) => e.id === c.id);
          if (edge) {
            window.dispatchEvent(
              new CustomEvent("request-delete-member", {
                detail: { edgeId: edge.id, edgeType: edge.data?.type },
              }),
            );
          }
          return false;
        }
        return true;
      });

      if (changesToApply.length > 0) {
        onEdgesChangeBase(changesToApply);
      }
    },
    [onEdgesChangeBase, readOnly, setEdges],
  );

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      onNodeSelect(node.data as Member);
      console.log("selected", node.data.position_x, node.data.position_y);
      const isMultiSelect = event.ctrlKey || event.metaKey;
      if (isMultiSelect) {
        dispatch(toggleNodeSelection(node.id));
      } else {
        dispatch(setSelectedNodeIds([node.id]));
      }
    },
    [dispatch, onNodeSelect],
  );

  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      const isSpouse = edge.data?.type === "spouse";

      const graphEdge: GraphEdge = {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: (edge.data?.type as string) || (edge.type as string),
        data: edge.data,
      };

      if (onEdgeSelect) {
        onEdgeSelect(isSpouse ? graphEdge : null);
      }

      // Keep node selection as-is, just select edge
      updateSelectionAndStyles(selectedNodeIds, edge.id);
    },
    [onEdgeSelect, selectedNodeIds, updateSelectionAndStyles],
  );

  const onPaneClick = useCallback(() => {
    onNodeSelect(null);
    onEdgeSelect?.(null);
    dispatch(clearNodeSelection());
    updateSelectionAndStyles([], null);
  }, [dispatch, onEdgeSelect, onNodeSelect, updateSelectionAndStyles]);

  const onMoveEnd = useCallback(
    (_event: unknown, viewport: Viewport) => {
      if (familyId)
        localStorage.setItem(`viewport-${familyId}`, JSON.stringify(viewport));
    },
    [familyId],
  );

  const onNodeMouseEnter = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === node.id ? { ...n, zIndex: 1000 } : { ...n, zIndex: 0 },
        ),
      );
    },
    [setNodes],
  );

  const onNodeMouseLeave = useCallback(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, zIndex: undefined })));
  }, [setNodes]);

  return (
    <div
      className="w-full h-full bg-slate-50 relative"
      ref={reactFlowWrapperRef}
    >
      <ReactFlow
        nodes={nodes.map((n) => ({
          ...n,
          draggable: !readOnly,
          connectable: !readOnly,
        }))}
        edges={edges.map((e) => ({ ...e, deletable: !readOnly }))}
        onInit={(instance) => (reactFlowInstance.current = instance)}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChangeIntercepted}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onConnect={readOnly ? undefined : onConnect}
        connectionMode={ConnectionMode.Loose}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onPaneClick={onPaneClick}
        onMoveEnd={onMoveEnd}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesConnectable={!readOnly}
        nodesDraggable={!readOnly}
        elementsSelectable={true}
      >
        <Background />
        <Controls />
        <Panel position="top-center">
          <div className="flex flex-col items-center gap-2">
            <FamilyManager
              families={families}
              currentFamily={currentFamily}
              onSelectFamily={onSelectFamily}
              onFamilyCreated={onFamilyCreated}
            />

            {!readOnly && onAddMember && (
              <button
                onClick={handleAddMemberClick}
                className="bg-white p-2 rounded shadow-md border hover:bg-gray-50
                   flex items-center gap-2 text-sm font-medium text-blue-600"
                title={t("member.add")}
              >
                <Plus size={16} />
                {t("member.add")}
              </button>
            )}
          </div>
        </Panel>
        <Panel position="top-right" className="flex gap-2">
          <button
            onClick={handleCenterView}
            className="bg-white p-2 rounded shadow-md border hover:bg-gray-50 flex items-center gap-2 text-sm font-medium text-gray-700"
            title={t("family.center_view", { defaultValue: "Center View" })}
          >
            <Focus size={16} />
            {t("family.center_view", { defaultValue: "Center View" })}
          </button>
          {!readOnly && (
            <button
              onClick={handleAutoLayout}
              className="bg-white p-2 rounded shadow-md border hover:bg-gray-50 flex items-center gap-2 text-sm font-medium text-gray-700"
              title={t("family.auto_layout", { defaultValue: "Auto Layout" })}
            >
              <Layout size={16} />
              {t("family.auto_layout", { defaultValue: "Auto Layout" })}
            </button>
          )}
        </Panel>

        {/* Timeline Slider */}
        {state.timelineEnabled && (
          <Panel position="bottom-center" className="mb-8 w-96 max-w-[90vw]">
            <div className="bg-white/90 p-4 rounded-xl shadow-lg backdrop-blur-sm border">
              <div className="flex justify-between text-xs font-bold text-gray-500 mb-2">
                <span>{yearRange.min}</span>
                <span className="text-blue-600 text-lg">
                  {state.timelineYear || yearRange.max}
                </span>
                <span>{yearRange.max}</span>
              </div>
              <input
                type="range"
                min={yearRange.min}
                max={yearRange.max}
                value={state.timelineYear || yearRange.max}
                onChange={(e) =>
                  dispatch(setTimelineYear(parseInt(e.target.value)))
                }
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="text-center mt-1 text-xs text-gray-400">
                {t("timeline.drag_to_travel", { defaultValue: "Timeline" })}
              </div>
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
};

export default FamilyTreeCanvas;
