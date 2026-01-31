import FamilyManager from "@/components/FamilyManager";
import { useFamilyData } from "@/hooks/familyTree/useFamilyData";
import { useGraphInteraction } from "@/hooks/familyTree/useGraphInteraction";
import { useHighlighting } from "@/hooks/familyTree/useHighlighting";
import { useSettings } from "@/hooks/useSettings";
import { updateMember } from "@/services/api";
import { RootState } from "@/store";
import {
  clearNodeSelection,
  setSelectedNodeIds,
  toggleNodeSelection,
} from "@/store/familySlice";
import { setTimelineYear } from "@/store/settingsSlice";
import {
  CompactLayoutStrategy,
  NormalLayoutStrategy,
} from "@/strategies/layout/RecursiveFamilyLayoutStrategy";
import { Family, GraphEdge, Member } from "@/types";
import { Focus, Layout, Plus } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import ReactFlow, {
  Background,
  ConnectionMode,
  Controls,
  Edge,
  Node,
  OnSelectionChangeParams,
  Panel,
  ReactFlowInstance,
  SelectionMode,
  Viewport,
  useEdgesState,
  useNodesState
} from "reactflow";
import "reactflow/dist/style.css";
import { CustomEdge } from "./CustomEdge";
import MemberNode from "./MemberNode";

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
  const { state: settingsState } = useSettings();
  const dispatch = useDispatch();

  const selectedNodeIds = useSelector(
    (s: RootState) => s.family?.selectedNodeIds || []
  );

  const [nodes, setNodes, onNodesChangeBase] = useNodesState([]);
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  // Custom hooks
  const { applyHighlight } = useHighlighting();

  const { fetchData, yearRange, nodesRef, edgesRef } = useFamilyData({
    familyId,
    setNodes,
    setEdges,
    reactFlowInstance,
    selectedNodeIds,
    selectedEdgeId,
    setSelectedEdgeId,
  });

  useEffect(() => void (nodesRef.current = nodes), [nodes, nodesRef]);
  useEffect(() => void (edgesRef.current = edges), [edges, edgesRef]);

  const {
    onConnectStart,
    onConnect,
    onConnectEnd,
    onNodeDrag,
    onNodeDragStop,
    onNodesChange,
    onEdgesChange,
  } = useGraphInteraction({
    reactFlowInstance,
    nodesRef,
    edgesRef,
    readOnly,
    selectedNodeIds,
    setNodes,
    setEdges,
    onNodesChangeBase,
    onEdgesChangeBase,
    fetchData,
  });

  // Fetch data on init
  useEffect(() => {
    if (familyId) fetchData();
  }, [familyId, fetchData, refreshTrigger]);

  // --- Highlight Effect ---
  // This handles visual updates when selection or settings change, WITHOUT re-fetching data.
  useEffect(() => {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;

    if (currentNodes.length === 0) return;

    const { nodes: styledNodes, edges: styledEdges } = applyHighlight(
      currentNodes,
      currentEdges,
      selectedNodeIds,
      selectedEdgeId
    );

    // Optimization: Only call setNodes/setEdges if something meaningful changed?
    // For now, we rely on ReactFlow's diffing, but we must ensure we don't trigger
    // infinite loops with onSelectionChange.

    setNodes(styledNodes);
    setEdges(styledEdges);
  }, [
    applyHighlight,
    selectedEdgeId,
    selectedNodeIds,
    setEdges,
    setNodes,
    nodesRef,
    edgesRef,
    // Add settings primitives to trigger update when settings change
    settingsState.focusModeEnabled,
    settingsState.focusRelations,
    settingsState.privacyMode,
    settingsState.showDeceased,
    settingsState.timelineEnabled,
    settingsState.timelineYear,
    settingsState.compactMode
  ]);


  // --- Event Handlers ---

  const handleAutoLayout = useCallback(async () => {
    const layoutStrategy = settingsState.compactMode
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
        })
      );
      await Promise.all(promises);
      toast.success(
        t("family.layout_updated", { defaultValue: "Layout updated" })
      );
    } catch (e) {
      console.error("Failed to save layout", e);
      toast.error("Failed to save layout");
    }
  }, [settingsState.compactMode, nodesRef, edgesRef, setNodes, setEdges, t]);

  const handleCenterView = useCallback(() => {
    reactFlowInstance.current?.fitView({ duration: 800 });
  }, []);

  const reactFlowWrapperRef = useRef<HTMLDivElement>(null);

  const handleAddMemberClick = useCallback(() => {
    if (!onAddMember) return;
    if (!reactFlowInstance.current) return;
    if (!reactFlowWrapperRef.current) return;
    const rect = reactFlowWrapperRef.current.getBoundingClientRect();
    const center = reactFlowInstance.current.screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
    onAddMember(center);
  }, [onAddMember]);

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      onNodeSelect(node.data as Member);

      const isMultiSelect = event.ctrlKey || event.metaKey;
      if (isMultiSelect) {
        dispatch(toggleNodeSelection(node.id));
      } else {
        dispatch(setSelectedNodeIds([node.id]));
      }
    },
    [dispatch, onNodeSelect]
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
      setSelectedEdgeId(edge.id);
    },
    [onEdgeSelect]
  );

  const onPaneClick = useCallback(() => {
    onNodeSelect(null);
    onEdgeSelect?.(null);
    dispatch(clearNodeSelection());
    setSelectedEdgeId(null);
  }, [dispatch, onEdgeSelect, onNodeSelect]);

  // Use a ref for selectedNodeIds in onSelectionChange to keep the handler stable
  // This prevents ReactFlow from re-binding listeners constantly
  const selectedNodeIdsRef = useRef(selectedNodeIds);
  useEffect(() => {
    selectedNodeIdsRef.current = selectedNodeIds;
  }, [selectedNodeIds]);

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: OnSelectionChangeParams) => {
      // Handle Shift+Box selection syncing to Redux
      const selectedIds = selectedNodes.map(n => n.id);
      const currentIds = selectedNodeIdsRef.current;

      // Check equality to prevent loops
      const sortedSelected = [...selectedIds].sort();
      const sortedCurrent = [...currentIds].sort();

      const isSame = sortedSelected.length === sortedCurrent.length &&
        sortedSelected.every((id, index) => id === sortedCurrent[index]);

      if (!isSame) {
        dispatch(setSelectedNodeIds(selectedIds));
      }
    },
    [dispatch]
  );

  const onMoveEnd = useCallback(
    (_event: unknown, viewport: Viewport) => {
      if (familyId)
        localStorage.setItem(`viewport-${familyId}`, JSON.stringify(viewport));
    },
    [familyId]
  );

  const onNodeMouseEnter = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === node.id ? { ...n, zIndex: 1000 } : { ...n, zIndex: 0 }
        )
      );
    },
    [setNodes]
  );

  const onNodeMouseLeave = useCallback(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, zIndex: undefined })));
  }, [setNodes]);

  const nodeTypes = useMemo(() => ({
    member: MemberNode,
  }), []);

  const edgeTypes = useMemo(() => ({
    custom: CustomEdge,
  }), []);

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
          // Sync selection state to ReactFlow
          selected: selectedNodeIds.includes(n.id)
        }))}
        edges={edges.map((e) => ({ ...e, deletable: !readOnly }))}
        onInit={(instance) => (reactFlowInstance.current = instance)}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onConnect={readOnly ? undefined : onConnect}
        connectionMode={ConnectionMode.Loose}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onPaneClick={onPaneClick}
        onMoveEnd={onMoveEnd}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesConnectable={!readOnly}
        nodesDraggable={!readOnly}
        elementsSelectable={true}
        // Enable multi-selection features
        selectionOnDrag={true}
        selectionMode={SelectionMode.Partial}
        panOnDrag={true}
        selectionKeyCode="Shift"
        multiSelectionKeyCode="Control"
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
        {settingsState.timelineEnabled && (
          <Panel position="bottom-center" className="mb-8 w-96 max-w-[90vw]">
            <div className="bg-white/90 p-4 rounded-xl shadow-lg backdrop-blur-sm border">
              <div className="flex justify-between text-xs font-bold text-gray-500 mb-2">
                <span>{yearRange.min}</span>
                <span className="text-blue-600 text-lg">
                  {settingsState.timelineYear || yearRange.max}
                </span>
                <span>{yearRange.max}</span>
              </div>
              <input
                type="range"
                min={yearRange.min}
                max={yearRange.max}
                value={settingsState.timelineYear || yearRange.max}
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
