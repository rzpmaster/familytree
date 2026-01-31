import { parseDate } from "@/lib/utils";
import { getFamilyGraph } from "@/services/api";
import { GraphEdge, GraphNode, Member } from "@/types";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { Edge, Node, ReactFlowInstance, Viewport } from "reactflow";
import { useHighlighting } from "./useHighlighting";

interface UseFamilyDataProps {
  familyId: string;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  reactFlowInstance: React.MutableRefObject<ReactFlowInstance | null>;
  selectedNodeIds: string[];
  selectedEdgeId: string | null;
  setSelectedEdgeId: (id: string | null) => void;
}

export function useFamilyData({
  familyId,
  setNodes,
  setEdges,
  reactFlowInstance,
  selectedNodeIds,
  selectedEdgeId,
}: UseFamilyDataProps) {
  const { t } = useTranslation();
  const { applyHighlight } = useHighlighting();

  const hasFittedView = useRef<string | null>(null);
  const [yearRange, setYearRange] = useState<{ min: number; max: number }>({
    min: 1900,
    max: new Date().getFullYear(),
  });

  // Keep latest nodes/edges for highlight calculations
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);

  // Refs to access latest state inside useCallback without triggering re-creation
  const selectedNodeIdsRef = useRef(selectedNodeIds);
  const selectedEdgeIdRef = useRef(selectedEdgeId);
  const applyHighlightRef = useRef(applyHighlight);

  useEffect(() => {
    selectedNodeIdsRef.current = selectedNodeIds;
  }, [selectedNodeIds]);

  useEffect(() => {
    selectedEdgeIdRef.current = selectedEdgeId;
  }, [selectedEdgeId]);

  useEffect(() => {
    applyHighlightRef.current = applyHighlight;
  }, [applyHighlight]);

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
    [t]
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
        graphData.edges
      );

      // Save raw data
      nodesRef.current = flowNodes;
      edgesRef.current = flowEdges;

      // Apply initial highlight using REFS to avoid dependency loop
      const { nodes: highlightedNodes, edges: highlightedEdges } = applyHighlightRef.current(
        flowNodes,
        flowEdges,
        selectedNodeIdsRef.current,
        selectedEdgeIdRef.current
      );

      setNodes(highlightedNodes);
      setEdges(highlightedEdges);

      // Fit view / restore viewport
      if (flowNodes.length > 0) {
        if (hasFittedView.current !== familyId) {
          hasFittedView.current = familyId;
          const savedViewport = localStorage.getItem(`viewport-${familyId}`);
          if (savedViewport) {
            const viewport = JSON.parse(savedViewport) as Viewport;
            setTimeout(
              () => reactFlowInstance.current?.setViewport(viewport),
              50
            );
          } else {
            setTimeout(
              () => reactFlowInstance.current?.fitView({ duration: 800 }),
              100
            );
          }
        }
      }

    } catch (error) {
      console.error("Failed to fetch graph data", error);
      toast.error("Failed to load family tree");
    }
  }, [
    familyId,
    buildFlowEdges,
    setNodes,
    setEdges,
    reactFlowInstance
  ]);

  return { fetchData, yearRange, nodesRef, edgesRef };
}
