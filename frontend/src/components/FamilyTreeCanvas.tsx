import { useSettings } from '@/hooks/useSettings';
import { Focus, Layout } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import ReactFlow, {
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
    Viewport
} from 'reactflow';
import 'reactflow/dist/style.css';
import { createParentChildRelationship, createSpouseRelationship, getFamilyGraph, updateMember } from '../services/api';
import { RecursiveFamilyLayoutStrategy } from '../strategies/layout/RecursiveFamilyLayoutStrategy';
import { GraphEdge, Member } from '../types';
import { RuleEngine } from '../validation/RuleEngine';
import { ChildBirthPosthumousRule, MaxParentsRule, ParentAgeRule } from '../validation/rules/parentChildRules';
import { LifespanOverlapRule, OppositeGenderRule } from '../validation/rules/spouseRules';
import { CustomEdge } from './CustomEdge';
import MemberNode from './MemberNode';

const nodeTypes: NodeTypes = {
  member: MemberNode,
};

const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
};

interface FamilyTreeCanvasProps {
  familyId: string;
  onNodeSelect: (member: Member | null) => void;
  onEdgeSelect?: (edge: GraphEdge | null) => void;
  refreshTrigger?: number;
  readOnly?: boolean;
}

const FamilyTreeCanvas: React.FC<FamilyTreeCanvasProps> = ({ familyId, onNodeSelect, onEdgeSelect, refreshTrigger = 0, readOnly = false }) => {
  const { t } = useTranslation();
  const { state } = useSettings();
  const settingsRef = useRef(state);

  useEffect(() => {
    settingsRef.current = state;
    // When settings change, re-apply styles
    updateSelectionAndStyles(selectedNodeId, selectedEdgeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.focusModeEnabled, state.focusRelations]); 

  const [nodes, setNodes] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const hasFittedView = useRef<string | null>(null); 

  // Refs for custom connection logic
  const connectionStartRef = useRef<{ nodeId: string | null; handleId: string | null; handleType: string | null } | null>(null);
  const connectionProcessedRef = useRef(false);

  const applyHighlight = useCallback((currentNodes: Node[], currentEdges: Edge[], selectedNId: string | null, selectedEId: string | null) => {
      const { focusModeEnabled, focusRelations } = settingsRef.current;

      if ((!selectedNId && !selectedEId) || !focusModeEnabled) {
          return {
              nodes: currentNodes.map(n => ({ ...n, style: { ...n.style, opacity: 1 } })),
              edges: currentEdges.map(e => ({ ...e, style: { ...e.style, opacity: 1 } }))
          };
      }

      const relevantNodeIds = new Set<string>();

      if (selectedNId) {
          relevantNodeIds.add(selectedNId);

          // Parents
          currentEdges
              .filter(e => e.target === selectedNId && e.data?.type === 'parent-child')
              .forEach(e => {
                  const parentNode = currentNodes.find(n => n.id === e.source);
                  if (parentNode) {
                      const gender = parentNode.data?.gender;
                      if (gender === 'male' && focusRelations.father) relevantNodeIds.add(e.source);
                      if (gender === 'female' && focusRelations.mother) relevantNodeIds.add(e.source);
                      if (!gender && (focusRelations.father || focusRelations.mother)) relevantNodeIds.add(e.source);
                  }
              });

          // Spouses
          if (focusRelations.spouse) {
              currentEdges
                  .filter(e => (e.source === selectedNId || e.target === selectedNId) && e.data?.type === 'spouse')
                  .forEach(e => relevantNodeIds.add(e.source === selectedNId ? e.target : e.source));
          }

          // Children
          currentEdges
              .filter(e => e.source === selectedNId && e.data?.type === 'parent-child')
              .forEach(e => {
                  const childNode = currentNodes.find(n => n.id === e.target);
                  if (childNode) {
                      const gender = childNode.data?.gender;
                      if (gender === 'male' && focusRelations.son) relevantNodeIds.add(e.target);
                      if (gender === 'female' && focusRelations.daughter) relevantNodeIds.add(e.target);
                      if (!gender && (focusRelations.son || focusRelations.daughter)) relevantNodeIds.add(e.target);
                  }
              });
      }

      if (selectedEId) {
          const edge = currentEdges.find(e => e.id === selectedEId);
          if (edge) {
              relevantNodeIds.add(edge.source);
              relevantNodeIds.add(edge.target);
          }
      }
      
      const newNodes = currentNodes.map(node => ({
          ...node,
          style: {
              ...node.style,
              opacity: relevantNodeIds.has(node.id) ? 1 : 0.1
          }
      }));

      const newEdges = currentEdges.map(edge => {
          let isRelevant = false;
          if (selectedEId) {
              isRelevant = edge.id === selectedEId;
          } else if (selectedNId) {
              isRelevant = relevantNodeIds.has(edge.source) && relevantNodeIds.has(edge.target);
          }
          
          return {
              ...edge,
              style: {
                  ...edge.style,
                  opacity: isRelevant ? 1 : 0.1
              }
          };
      });

      return { nodes: newNodes, edges: newEdges };
  }, []);

  const handleAutoLayout = useCallback(async () => {
      const layoutStrategy = new RecursiveFamilyLayoutStrategy();
      const { nodes: layoutedNodes, edges: layoutedEdges } = layoutStrategy.layout([...nodes], [...edges]);
      
      setNodes([...layoutedNodes]);
      setEdges([...layoutedEdges]);
      
      try {
          const promises = layoutedNodes.map(node => 
              updateMember(node.id, {
                  position_x: Math.round(node.position.x),
                  position_y: Math.round(node.position.y)
              })
          );
          await Promise.all(promises);
          toast.success(t('family.layout_updated', { defaultValue: 'Layout updated' }));
      } catch (e) {
          console.error("Failed to save layout", e);
          toast.error("Failed to save layout");
      }
      
  }, [nodes, edges, setNodes, setEdges, t]);

  const handleCenterView = useCallback(() => {
      if (reactFlowInstance.current) {
          reactFlowInstance.current.fitView({ duration: 800 });
      }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const graphData = await getFamilyGraph(familyId);
      
      const flowNodes: Node[] = graphData.nodes.map((node) => ({
        id: node.id,
        type: 'member',
        position: { x: node.x, y: node.y },
        data: node.data,
      }));

      const flowEdges: Edge[] = [];
      const nodeHandleEdges: Record<string, string[]> = {};
      const edgeHandles: Record<string, { sourceHandle: string, targetHandle: string }> = {};

      graphData.edges.forEach(edge => {
          if (edge.type === 'spouse') {
              const sourceNode = graphData.nodes.find(n => n.id === edge.source);
              const targetNode = graphData.nodes.find(n => n.id === edge.target);
              
              let sourceHandle = 'right-source';
              let targetHandle = 'left-target';

              if (sourceNode && targetNode) {
                  if (sourceNode.x > targetNode.x) {
                      sourceHandle = 'left-source';
                      targetHandle = 'right-target';
                  } else {
                      sourceHandle = 'right-source';
                      targetHandle = 'left-target';
                  }
              }
              
              edgeHandles[edge.id] = { sourceHandle, targetHandle };

              const sourceKey = `${edge.source}-${sourceHandle}`;
              const targetKey = `${edge.target}-${targetHandle}`;
              
              if (!nodeHandleEdges[sourceKey]) nodeHandleEdges[sourceKey] = [];
              nodeHandleEdges[sourceKey].push(edge.id);
              
              if (!nodeHandleEdges[targetKey]) nodeHandleEdges[targetKey] = [];
              nodeHandleEdges[targetKey].push(edge.id);
          }
      });
      
      graphData.edges.forEach((edge) => {
        let sourceOffsetIndex = 0;
        let targetOffsetIndex = 0;
        let sourceHandle = undefined;
        let targetHandle = undefined;
        
        if (edge.type === 'spouse') {
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
                 
                 if (sourceIdx !== -1) sourceOffsetIndex = sourceIdx - (sourceList.length - 1) / 2;
                 if (targetIdx !== -1) targetOffsetIndex = targetIdx - (targetList.length - 1) / 2;
             }
        }

        flowEdges.push({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: sourceHandle,
          targetHandle: targetHandle,
          label: edge.label ? t(edge.label) : (edge.type === 'spouse' ? t('relation.spouse') : ''),
          type: 'custom', 
          animated: false,
          style: { stroke: edge.type === 'spouse' ? '#ff0072' : '#000', strokeWidth: 2 },
          data: { 
              type: edge.type,
              sourceOffsetIndex,
              targetOffsetIndex
          }
        });
      });

      setNodes(() => {
          const { nodes: highlightedNodes } = applyHighlight(flowNodes, flowEdges, selectedNodeId, selectedEdgeId);
          return highlightedNodes;
      });
      setEdges(() => {
          const { edges: highlightedEdges } = applyHighlight(flowNodes, flowEdges, selectedNodeId, selectedEdgeId);
          return highlightedEdges;
      });

      if (nodes.length === 0 && flowNodes.length > 0) {
          if (hasFittedView.current !== familyId) {
             hasFittedView.current = familyId;
             const savedViewport = localStorage.getItem(`viewport-${familyId}`);
             if (savedViewport) {
                 const viewport = JSON.parse(savedViewport);
                 setTimeout(() => {
                     if (reactFlowInstance.current) {
                         reactFlowInstance.current.setViewport(viewport);
                     }
                 }, 50);
             } else {
                 setTimeout(() => {
                     if (reactFlowInstance.current) {
                         reactFlowInstance.current.fitView({ duration: 800 });
                     }
                 }, 100);
             }
          }
      } else if (flowNodes.length > 0 && (selectedNodeId || selectedEdgeId)) {
          const edgesWithSelection = flowEdges.map(e => ({
              ...e,
              selected: e.id === selectedEdgeId
          }));
          
          const { nodes: highlightedNodes } = applyHighlight(flowNodes, edgesWithSelection, selectedNodeId, selectedEdgeId);
          const { edges: highlightedEdges } = applyHighlight(flowNodes, edgesWithSelection, selectedNodeId, selectedEdgeId);
          
          setNodes(highlightedNodes);
          setEdges(highlightedEdges);
          return;
      }
    } catch (error) {
      console.error("Failed to fetch graph data", error);
      toast.error("Failed to load family tree");
    }
  }, [familyId, setNodes, setEdges, nodes.length, selectedNodeId, selectedEdgeId, t, applyHighlight]); 

  useEffect(() => {
    if (familyId) {
      fetchData();
    }
  }, [familyId, fetchData, refreshTrigger]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (readOnly) {
          const allowedChanges = changes.filter(c => c.type === 'select');
          if (allowedChanges.length > 0) {
              setNodes((nds) => applyNodeChanges(allowedChanges, nds));
          }
          return;
      }
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    [setNodes, readOnly]
  );

  const onNodeDragStop = useCallback(async (_event: React.MouseEvent, node: Node) => {
      if (readOnly) return;
      try {
          await updateMember(node.id, {
              position_x: Math.round(node.position.x),
              position_y: Math.round(node.position.y)
          });
      } catch (err) {
          console.error("Failed to update position", err);
          toast.error("Failed to save position");
      }
  }, [readOnly]);

  const onConnectStart = useCallback((_: unknown, params: OnConnectStartParams) => {
      if (readOnly) return;
      connectionStartRef.current = { 
          nodeId: params.nodeId, 
          handleId: params.handleId, 
          handleType: params.handleType 
      };
      connectionProcessedRef.current = false;
  }, [readOnly]);

  const processConnection = useCallback(async (targetNodeId: string) => {
      if (!connectionStartRef.current || !connectionStartRef.current.nodeId) return;
      
      const { nodeId: sourceNodeId, handleId: sourceHandleId, handleType: sourceHandleType } = connectionStartRef.current;
      
      if (sourceNodeId === targetNodeId) return; 

      let type = 'parent-child'; 
      let relType = 'father'; 
      
      const isSpouse = sourceHandleId?.includes('left') || sourceHandleId?.includes('right');
      
      let finalSourceId = sourceNodeId;
      let finalTargetId = targetNodeId;
      
      if (isSpouse) {
          type = 'spouse';
      } else {
          if (sourceHandleType === 'target') {
              finalSourceId = targetNodeId; 
              finalTargetId = sourceNodeId; 
          } else {
              finalSourceId = sourceNodeId; 
              finalTargetId = targetNodeId; 
          }
      }

      const sourceNode = nodes.find(n => n.id === finalSourceId);
      const targetNode = nodes.find(n => n.id === finalTargetId);
      
      if (!sourceNode || !targetNode) {
          toast.error("Source or Target node not found");
          return;
      }

      const existingEdges: GraphEdge[] = edges.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          type: e.data?.type || e.type || 'custom',
          data: e.data
      }));

      const allMembers: Member[] = nodes.map(n => n.data as Member);

      const validationContext = {
          source: sourceNode.data as Member,
          target: targetNode.data as Member,
          relationshipType: type as 'spouse' | 'parent-child',
          existingEdges: existingEdges,
          allNodes: allMembers
      };

      const rules = [
          OppositeGenderRule,
          LifespanOverlapRule,
          ParentAgeRule,
          ChildBirthPosthumousRule,
          MaxParentsRule
      ];
      
      const engine = new RuleEngine(rules);
      const validationResult = engine.validate(validationContext);

      if (!validationResult.valid) {
          if (validationResult.errorKey) {
              toast.error(t(validationResult.errorKey));
          } else {
              toast.error("Validation failed");
          }
          return; 
      }
      
      try {
          if (type === 'spouse') {
             await createSpouseRelationship(finalSourceId, finalTargetId);
             toast.success(t('relation.created'));
          } else {
             const gender = sourceNode.data.gender;
             relType = gender === 'female' ? 'mother' : 'father';
             
             await createParentChildRelationship(finalSourceId, finalTargetId, relType as 'father'|'mother');
             toast.success(t('relation.created'));
          }
          fetchData();
      } catch (err) {
          console.error("Failed to create relationship", err);
          toast.error(t('relation.create_failed'));
      }
  }, [nodes, edges, fetchData, t]);

  const onConnect = useCallback(
    (params: Connection) => {
      connectionProcessedRef.current = true;
      const initiatorId = connectionStartRef.current?.nodeId;
      if (!initiatorId) return;

      const otherNodeId = params.source === initiatorId ? params.target : params.source;
      if (otherNodeId) {
          processConnection(otherNodeId);
      }
    },
    [processConnection]
  );

  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
      if (connectionProcessedRef.current) return;
      
      const targetNode = (event.target as Element).closest('.react-flow__node');
      if (targetNode) {
          const targetId = targetNode.getAttribute('data-id');
          if (targetId) {
              processConnection(targetId);
          }
      }
  }, [processConnection]);
  
  const onEdgesChangeIntercepted = useCallback((changes: EdgeChange[]) => {
      if (readOnly) {
          const allowedChanges = changes.filter(c => c.type === 'select');
          if (allowedChanges.length > 0) {
              setEdges((eds) => {
                  return eds; 
              });
          }
          return;
      }
      
      const changesToApply = changes.filter(c => {
          if (c.type === 'remove') {
              const edge = edges.find(e => e.id === c.id);
              if (edge) {
                  window.dispatchEvent(new CustomEvent('request-delete-member', {
                      detail: { 
                          edgeId: edge.id,
                          edgeType: edge.data?.type 
                      }
                  }));
              }
              return false; 
          }
          return true;
      });
      
      if (changesToApply.length > 0) {
          onEdgesChange(changesToApply);
      }
  }, [edges, onEdgesChange, readOnly, setEdges]);

  const updateSelectionAndStyles = useCallback((nId: string | null, eId: string | null) => {
      setSelectedNodeId(nId);
      setSelectedEdgeId(eId);

      setNodes((currentNodes) => {
          const { nodes: styledNodes } = applyHighlight(currentNodes, edges, nId, eId);
          return styledNodes;
      });

      setEdges((currentEdges) => {
          const edgesWithSelection = currentEdges.map(e => ({
              ...e,
              selected: e.id === eId
          }));
          const { edges: styledEdges } = applyHighlight(nodes, edgesWithSelection, nId, eId);
          return styledEdges;
      });
  }, [edges, nodes, setNodes, setEdges, applyHighlight]); 

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
      onNodeSelect(node.data as Member);
      updateSelectionAndStyles(node.id, null);
  }, [onNodeSelect, updateSelectionAndStyles]);

  const onEdgeSelectCallback = onEdgeSelect;

  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
      const isSpouse = edge.data?.type === 'spouse';
      
      const graphEdge = {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: edge.data?.type || edge.type,
          data: edge.data
      };
      
      if (onEdgeSelectCallback) {
          if (isSpouse) {
             onEdgeSelectCallback(graphEdge);
          } else {
             onEdgeSelectCallback(null);
          }
      }
      
      updateSelectionAndStyles(null, edge.id);
  }, [onEdgeSelectCallback, updateSelectionAndStyles]);

  const onPaneClick = useCallback(() => {
      onNodeSelect(null);
      if (onEdgeSelectCallback) onEdgeSelectCallback(null);
      updateSelectionAndStyles(null, null);
  }, [onNodeSelect, onEdgeSelectCallback, updateSelectionAndStyles]);

  const onMoveEnd = useCallback((_event: unknown, viewport: Viewport) => {
      if (familyId) {
          localStorage.setItem(`viewport-${familyId}`, JSON.stringify(viewport));
      }
  }, [familyId]);

  const onNodeMouseEnter = useCallback((_event: React.MouseEvent, node: Node) => {
      setNodes((nds) => nds.map(n => {
          if (n.id === node.id) {
              return { ...n, zIndex: 1000 }; 
          }
          return { ...n, zIndex: 0 }; 
      }));
  }, [setNodes]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const onNodeMouseLeave = useCallback((event: React.MouseEvent, node: Node) => { 
      setNodes((nds) => nds.map(n => ({ ...n, zIndex: undefined })));
  }, [setNodes]);

  return (
    <div className="w-full h-full bg-slate-50">
      <ReactFlow
        nodes={nodes.map(n => ({ ...n, draggable: !readOnly, connectable: !readOnly }))}
        edges={edges.map(e => ({ ...e, deletable: !readOnly }))}
        onInit={(instance) => reactFlowInstance.current = instance}
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
        <Panel position="top-right" className="flex gap-2">
            <button 
                onClick={handleCenterView} 
                className="bg-white p-2 rounded shadow-md border hover:bg-gray-50 flex items-center gap-2 text-sm font-medium text-gray-700"
                title={t('family.center_view', { defaultValue: 'Center View' })}
            >
                <Focus size={16} />
                {t('family.center_view', { defaultValue: 'Center View' })}
            </button>
            {!readOnly && (
                <button 
                    onClick={handleAutoLayout} 
                    className="bg-white p-2 rounded shadow-md border hover:bg-gray-50 flex items-center gap-2 text-sm font-medium text-gray-700"
                    title={t('family.auto_layout', { defaultValue: 'Auto Layout' })}
                >
                    <Layout size={16} />
                    {t('family.auto_layout', { defaultValue: 'Auto Layout' })}
                </button>
            )}
        </Panel>
      </ReactFlow>
    </div>
  );
};

export default FamilyTreeCanvas;