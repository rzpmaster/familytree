import { Trash2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath, getSmoothStepPath } from 'reactflow';

export const CustomEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected,
}) => {
  const { t } = useTranslation();
  
  // Choose path type based on data.type or style
  // 'spouse' -> smoothstep, 'parent-child' -> bezier
  // But wait, ReactFlow calculates path based on `type` prop passed to `<ReactFlow edges={...}>`
  // If we use a custom edge component, we need to calculate path ourselves.
  // The edge object passed to ReactFlow has `type: 'custom'`.
  // But we want to support both styles.
  
  // We can pass the path logic type in `data.type`.
  const isSpouse = data?.type === 'spouse';
  
  // Check if nodes are close horizontally (side-by-side) to use straight line?
  // Or just reduce offset.
  // If we want "pull out from side", SmoothStep is usually correct for orthogonal edges.
  // The issue "bends a lot" might be because of default offset (20px).
  // If I set offset to 10 or 5, it turns earlier.
  
  // Also, if the target is to the LEFT of source (while connecting Right handle to Left handle),
  // SmoothStep will go around the node.
  // This is expected behavior to avoid crossing the node.
  
  // If the user means "just connect them directly regardless of obstacles", 
  // maybe StraightPath is better? But StraightPath looks ugly if not aligned.
  
  // Let's stick to SmoothStep but optimize parameters.
  // Maybe user wants "SimpleBezier" or "Step"?
  
  // Read offsets from data
  const sourceOffsetIndex = data?.sourceOffsetIndex || 0;
  const targetOffsetIndex = data?.targetOffsetIndex || 0;
  const GAP = 15; // Vertical gap between lines
  
  const [edgePath, labelX, labelY] = isSpouse
    ? getBezierPath({
        sourceX,
        sourceY: sourceY + sourceOffsetIndex * GAP,
        sourcePosition,
        targetX,
        targetY: targetY + targetOffsetIndex * GAP,
        targetPosition,
        curvature: 0.5, // Adjust curvature for spouse lines
      })
    : getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 5,
        offset: 20,
      });

  // Calculate if edge is dimmed (from style.opacity)
  const isDimmed = style.opacity === 0.1;
  const showControls = selected && !isDimmed;

  const onEdgeClick = (evt: React.MouseEvent, id: string) => {
    evt.stopPropagation();
    // Dispatch delete event
    window.dispatchEvent(new CustomEvent('request-delete-member', {
        detail: { 
            edgeId: id,
            edgeType: data?.type 
        }
    }));
  };

  // Dynamic style for selection
  const edgeStyle = {
      ...style,
      stroke: selected ? '#2563eb' : (style.stroke || '#000'), // Blue when selected
      strokeWidth: selected ? 3 : (style.strokeWidth || 2), // Thicker when selected
      opacity: style.opacity // Keep opacity from parent
  };

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={edgeStyle} />
      {showControls && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 12,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <button
              className="bg-red-100 hover:bg-red-200 text-red-600 rounded-full p-1.5 shadow-sm border border-red-200 transition-colors"
              onClick={(event) => onEdgeClick(event, id)}
              title={t('delete')}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};
