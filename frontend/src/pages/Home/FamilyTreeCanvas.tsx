import ConfirmDialog from "@/components/ConfirmDialog";
import FamilyManager from "@/components/FamilyManager";
import CreateRegionDialog from "@/components/Region/CreateRegionDialog";
import EditRegionDialog from "@/components/Region/EditRegionDialog";
import RegionNode from "@/components/Region/RegionNode";
import RegionPanel from "@/components/Region/RegionPanel";
import { useFamilyData } from "@/hooks/familyTree/useFamilyData";
import { useGraphInteraction } from "@/hooks/familyTree/useGraphInteraction";
import { useHighlighting } from "@/hooks/familyTree/useHighlighting";
import { useSettings } from "@/hooks/useSettings";
import { createRegion, deleteMember, deleteRegion, updateMember, updateRegion } from "@/services/api";
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
import { Family, GraphEdge, Member, Region } from "@/types";
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

  const { fetchData, yearRange, nodesRef, edgesRef, regions } = useFamilyData({
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


  // --- Region Logic ---
  const [createRegionDialogOpen, setCreateRegionDialogOpen] = useState(false);
  const [editRegionDialogOpen, setEditRegionDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);

  // Filter selected members (exclude regions)
  const selectedMembers = useMemo(() =>
    nodes.filter(n => selectedNodeIds.includes(n.id) && n.type === 'member'),
    [nodes, selectedNodeIds]);

  const handleDeleteAll = useCallback(async () => {
    if (window.confirm(t('common.confirm_delete_all', { defaultValue: 'Are you sure you want to delete these members?' }))) {
      try {
        const promises = selectedMembers.map(node => deleteMember(node.id));
        await Promise.all(promises);
        toast.success(t('common.deleted_success', { defaultValue: 'Deleted successfully' }));
        dispatch(clearNodeSelection());
        fetchData();
      } catch (e) {
        console.error("Failed to delete members", e);
        toast.error(t('common.error', { defaultValue: 'Error occurred' }));
      }
    }
  }, [selectedMembers, t, dispatch, fetchData]);

  const handleAddToRegion = async (regionId: string) => {
    try {
      const region = regions.find(r => r.id === regionId);
      if (!region) return;

      // Current members in this region (from graph data)
      const currentMemberIds = nodes
        .filter(n => n.type === 'member' && (n.data as Member).region_id === regionId)
        .map(n => n.id);
      
      const newMemberIds = selectedMembers.map(n => n.id);
      
      // Combine and remove duplicates
      const allMemberIds = Array.from(new Set([...currentMemberIds, ...newMemberIds]));
      
      await updateRegion(regionId, { member_ids: allMemberIds });
      toast.success(t('region.added_to', { defaultValue: 'Added to region' }));
      dispatch(clearNodeSelection());
      fetchData();
    } catch (e) {
      console.error("Failed to add to region", e);
      toast.error(t('region.add_failed', { defaultValue: 'Failed to add to region' }));
    }
  };

  const handleCreateRegion = () => {
    setCreateRegionDialogOpen(true);
  };

  const handleConfirmCreateRegion = async (name: string, description: string) => {
    try {
      const memberIds = selectedMembers.map(n => n.id);
      await createRegion(familyId, name, description, memberIds);
      toast.success(t('region.created', { defaultValue: 'Region created' }));
      setCreateRegionDialogOpen(false);
      dispatch(clearNodeSelection());
      fetchData();
    } catch (e) {
      console.error("Failed to create region", e);
      toast.error(t('region.create_failed', { defaultValue: 'Failed to create region' }));
    }
  };

  const handleConfirmEditRegion = async (name: string, description: string, color: string, memberIds: string[]) => {
    if (!editingRegion) return;
    try {
      await updateRegion(editingRegion.id, { name, description, member_ids: memberIds, color });
      toast.success(t('region.updated', { defaultValue: 'Region updated' }));
      setEditRegionDialogOpen(false);
      setEditingRegion(null);
      fetchData();
    } catch (e) {
      console.error("Failed to update region", e);
      toast.error(t('region.update_failed', { defaultValue: 'Failed to update region' }));
    }
  };

  const handleDeleteRegion = () => {
    if (!editingRegion) return;
    // Close edit dialog and open confirm dialog
    setEditRegionDialogOpen(false);
    setDeleteConfirmOpen(true);
  };

  const executeDeleteRegion = async () => {
    if (!editingRegion) return;
    try {
      await deleteRegion(editingRegion.id);
      toast.success(t('region.deleted', { defaultValue: 'Region deleted' }));
      setDeleteConfirmOpen(false);
      setEditingRegion(null);
      fetchData();
    } catch (e) {
      console.error("Failed to delete region", e);
      toast.error(t('region.delete_failed', { defaultValue: 'Failed to delete region' }));
    }
  };


  // --- Event Handlers ---

  const handleAutoLayout = useCallback(async () => {
    const layoutStrategy = settingsState.compactMode
      ? new CompactLayoutStrategy()
      : new NormalLayoutStrategy();

    // Filter out regions for layout? Or layout them too?
    // DagreLayoutStrategy usually expects connected nodes. Regions are not connected.
    // It might move them to (0,0).
    // So we should only layout members.
    const memberNodes = nodesRef.current.filter(n => n.type === 'member');
    const regionNodes = nodesRef.current.filter(n => n.type === 'region');

    // Edges only connect members usually
    const { nodes: layoutedMemberNodes, edges: layoutedEdges } =
      layoutStrategy.layout([...memberNodes], [...edgesRef.current]);

    // We need to re-calculate regions based on new member positions?
    // The fetchData/hook logic does this. But we don't want to re-fetch.
    // We can just keep regions as is for now (they will look wrong until refresh)
    // OR we can trigger a re-calc locally.
    // Ideally, we should update member positions on backend, then fetch.
    // But handleAutoLayout updates frontend state first.

    // Let's just update members. Regions will be outdated until save/refresh.
    // Or we can manually trigger fetchData after save.

    setNodes([...layoutedMemberNodes, ...regionNodes]); // Keep regions
    setEdges([...layoutedEdges]);

    try {
      const promises = layoutedMemberNodes.map((node) =>
        updateMember(node.id, {
          position_x: Math.round(node.position.x),
          position_y: Math.round(node.position.y),
        })
      );
      await Promise.all(promises);
      toast.success(
        t("family.layout_updated", { defaultValue: "Layout updated" })
      );
      // Refresh to update regions
      fetchData();
    } catch (e) {
      console.error("Failed to save layout", e);
      toast.error("Failed to save layout");
    }
  }, [settingsState.compactMode, nodesRef, edgesRef, setNodes, setEdges, t, fetchData]);

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
      if (node.type === 'member') {
        onNodeSelect(node.data as Member);
      } else if (node.type === 'region') {
        // Handle region click - Open Edit Dialog
        setEditingRegion(node.data.originalRegion);
        setEditRegionDialogOpen(true);
        // Do NOT select it as a node in Redux (to avoid "Delete All" showing up for regions)
        // Or maybe we want to allow selecting it?
        // The prompt says "Click region, can add and remove nodes".
        // It doesn't say we need to multi-select regions.
        return;
      }

      const isMultiSelect = event.ctrlKey || event.metaKey;
      if (isMultiSelect) {
        dispatch(toggleNodeSelection(node.id));
        // If multi-selecting, clear single selection in Home
        onNodeSelect(null);
        onEdgeSelect?.(null);
      } else {
        dispatch(setSelectedNodeIds([node.id]));
      }
    },
    [dispatch, onNodeSelect, onEdgeSelect]
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

  const selectedNodeIdsRef = useRef(selectedNodeIds);
  useEffect(() => {
    selectedNodeIdsRef.current = selectedNodeIds;
  }, [selectedNodeIds]);

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: OnSelectionChangeParams) => {
      // Only sync MEMBER selection to Redux?
      // If we allow selecting regions (e.g. via box select), we should filter them out 
      // OR handle them.
      // Current RegionNode has selectable: true.

      const memberIds = selectedNodes
        .filter(n => n.type === 'member')
        .map(n => n.id);

      const currentIds = selectedNodeIdsRef.current;

      const sortedSelected = [...memberIds].sort();
      const sortedCurrent = [...currentIds].sort();

      const isSame = sortedSelected.length === sortedCurrent.length &&
        sortedSelected.every((id, index) => id === sortedCurrent[index]);

      if (!isSame) {
        dispatch(setSelectedNodeIds(memberIds));
        
        // If multiple nodes are selected via box selection, clear property panel
        if (memberIds.length > 1) {
           onNodeSelect(null);
           onEdgeSelect?.(null);
        }
      }
    },
    [dispatch, onNodeSelect, onEdgeSelect]
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
      // Only for members
      if (node.type !== 'member') return;

      setNodes((nds) =>
        nds.map((n) =>
          n.id === node.id ? { ...n, zIndex: 1000 } : { ...n, zIndex: 0 }
        )
      );
    },
    [setNodes]
  );

  const onNodeMouseLeave = useCallback(() => {
    // Reset zIndex for members (regions have -1)
    setNodes((nds) => nds.map((n) => {
      if (n.type === 'region') return n;
      return { ...n, zIndex: undefined };
    }));
  }, [setNodes]);

  const nodeTypes = useMemo(() => ({
    member: MemberNode,
    region: RegionNode,
  }), []);

  const edgeTypes = useMemo(() => ({
    custom: CustomEdge,
  }), []);

  // Prepare data for Edit Dialog
  const currentRegionMemberIds = useMemo(() => {
    if (!editingRegion) return [];
    // We can filter nodes by region_id
    // But we need ALL members, not just those in graph (though graph has all usually).
    // Graph has all members of family.
    return nodes
      .filter(n => n.type === 'member' && (n.data as Member).region_id === editingRegion.id)
      .map(n => n.id);
  }, [nodes, editingRegion]);

  const allMembers = useMemo(() =>
    nodes.filter(n => n.type === 'member').map(n => n.data as Member),
    [nodes]);

  return (
    <div
      className="w-full h-full bg-slate-50 relative"
      ref={reactFlowWrapperRef}
    >
      <ReactFlow
        nodes={nodes.map((n) => ({
          ...n,
          draggable: !readOnly && n.type === 'member', // Only members draggable
          connectable: !readOnly && n.type === 'member',
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
        selectionOnDrag={true}
        selectionMode={SelectionMode.Partial}
        panOnDrag={true}
        selectionKeyCode="Shift"
        multiSelectionKeyCode="Control"
      >
        <Background />
        <Controls />

        {/* Region Panel */}
        <RegionPanel
          selectedCount={selectedMembers.length}
          onDeleteAll={handleDeleteAll}
          onCreateRegion={handleCreateRegion}
          onAddToRegion={handleAddToRegion}
          regions={regions}
        />

        {/* Dialogs */}
        <CreateRegionDialog
          isOpen={createRegionDialogOpen}
          onClose={() => setCreateRegionDialogOpen(false)}
          onConfirm={handleConfirmCreateRegion}
          selectedCount={selectedMembers.length}
        />

        <EditRegionDialog
          isOpen={editRegionDialogOpen}
          onClose={() => setEditRegionDialogOpen(false)}
          onConfirm={handleConfirmEditRegion}
          onDelete={handleDeleteRegion}
          initialColor={editingRegion?.color || '#EBF8FF'}
          initialName={editingRegion?.name || ''}
          initialDescription={editingRegion?.description || ''}
          currentMemberIds={currentRegionMemberIds}
          allMembers={allMembers}
        />

        <ConfirmDialog
          isOpen={deleteConfirmOpen}
          title={t('region.delete_title', { defaultValue: 'Delete Region' })}
          message={t('region.confirm_delete', { defaultValue: 'Are you sure you want to delete this region?' })}
          onConfirm={executeDeleteRegion}
          onCancel={() => {
             setDeleteConfirmOpen(false);
             setEditRegionDialogOpen(true); // Re-open edit dialog if canceled
          }}
          confirmText={t('common.delete', { defaultValue: 'Delete' })}
          cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
        />

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
