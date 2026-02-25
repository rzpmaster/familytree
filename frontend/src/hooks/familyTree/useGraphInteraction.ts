import {
  createParentChildRelationship,
  createSpouseRelationship,
  updateMembersPositions,
} from "@/services/api";
import { GraphEdge, Member } from "@/types";
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
import { useCallback, useRef } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  OnConnectStartParams,
  ReactFlowInstance,
  applyEdgeChanges,
  applyNodeChanges,
} from "reactflow";

interface UseGraphInteractionProps {
  familyId: string;
  reactFlowInstance: React.MutableRefObject<ReactFlowInstance | null>;
  nodesRef: React.MutableRefObject<Node[]>;
  edgesRef: React.MutableRefObject<Edge[]>;
  readOnly: boolean;
  selectedNodeIds: string[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  onNodesChangeBase: (changes: NodeChange[]) => void;
  onEdgesChangeBase: (changes: EdgeChange[]) => void;
  fetchData: () => void;
}

export function useGraphInteraction({
  familyId,
  nodesRef,
  edgesRef,
  readOnly,
  selectedNodeIds,
  setNodes,
  setEdges,
  onNodesChangeBase,
  onEdgesChangeBase,
  fetchData,
}: UseGraphInteractionProps) {
  const { t } = useTranslation();

  // --- Refs for connection logic ---
  const connectionStartRef = useRef<{
    nodeId: string | null;
    handleId: string | null;
    handleType: string | null;
  } | null>(null);
  const connectionProcessedRef = useRef(false);

  // --- Refs for multi-drag logic ---
  const multiDragStartRef = useRef<{
    draggingId: string;
    startPos: Record<string, { x: number; y: number }>;
  } | null>(null);

  // 1. Connection Start
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

  // 2. Process Connection
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
        type: e.type as "parent-child" | "spouse",
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
    [fetchData, nodesRef, edgesRef, t],
  );

  // 3. On Connect
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

  // 4. On Connect End
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

  // 5. Node Drag (Multi-select support)
  const onNodeDrag = useCallback(
    (_event: React.MouseEvent, draggingNode: Node) => {
      if (readOnly) return;

      if (
        !selectedNodeIds.includes(draggingNode.id) ||
        selectedNodeIds.length <= 1
      )
        return;

      if (!multiDragStartRef.current) {
        const startPos: Record<string, { x: number; y: number }> = {};
        for (const id of selectedNodeIds) {
          const n = nodesRef.current.find((x) => x.id === id);
          if (n) startPos[id] = { x: n.position.x, y: n.position.y };
        }
        multiDragStartRef.current = { draggingId: draggingNode.id, startPos };
      }

      const ctx = multiDragStartRef.current;
      if (!ctx) return;

      const base = ctx.startPos[draggingNode.id];
      if (!base) return;

      const dx = draggingNode.position.x - base.x;
      const dy = draggingNode.position.y - base.y;

      setNodes((nds) =>
        nds.map((n) => {
          if (!selectedNodeIds.includes(n.id)) return n;
          const start = ctx.startPos[n.id];
          if (!start) return n;
          return {
            ...n,
            position: { x: start.x + dx, y: start.y + dy },
            data: {
              ...(n.data as Member),
              // Position is now managed by ReactFlow node.position, not in Member data
            },
          };
        }),
      );
    },
    [readOnly, selectedNodeIds, nodesRef, setNodes],
  );

  // 6. Node Drag Stop
  const onNodeDragStop = useCallback(
    async (_event: React.MouseEvent, node: Node) => {
      if (readOnly) return;

      const idsToSave =
        selectedNodeIds.includes(node.id) && selectedNodeIds.length > 1
          ? selectedNodeIds
          : [node.id];

      multiDragStartRef.current = null;

      try {
        const latestNodes = nodesRef.current;
        const updates = idsToSave
          .map((id) => {
            const n = latestNodes.find((x) => x.id === id);
            if (!n) return null;
            return {
              id,
              position_x: Math.round(n.position.x),
              position_y: Math.round(n.position.y),
            };
          })
          .filter(
            (u): u is { id: string; position_x: number; position_y: number } =>
              u !== null,
          );

        if (updates.length > 0) {
          await updateMembersPositions(familyId, updates);
        }
      } catch (err) {
        console.error("Failed to update positions", err);
        toast.error("Failed to save position");
      }
    },
    [readOnly, selectedNodeIds, nodesRef, familyId],
  );

  // 7. On Nodes Change
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (readOnly) {
        // Only allow selection changes in read-only
        const allowed = changes.filter((c) => c.type === "select");
        if (allowed.length) setNodes((nds) => applyNodeChanges(allowed, nds));
        return;
      }
      onNodesChangeBase(changes);
    },
    [onNodesChangeBase, readOnly, setNodes],
  );

  // 8. On Edges Change
  const onEdgesChange = useCallback(
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
    [readOnly, edgesRef, onEdgesChangeBase, setEdges],
  );

  return {
    onConnectStart,
    onConnect,
    onConnectEnd,
    onNodeDrag,
    onNodeDragStop,
    onNodesChange,
    onEdgesChange,
  };
}
