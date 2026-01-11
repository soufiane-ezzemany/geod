import { BaseEdge, EdgeLabelRenderer, type EdgeProps, getBezierPath } from 'reactflow';
import { EdgeContextMenu } from './context-menus/EdgeContextMenu';

export default function CustomEdge({
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
  label,
  source,
  target,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <EdgeContextMenu 
        edgeId={id} 
        source={source} 
        target={target} 
        onAction={data?.onAction}
    >
        <>
            <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
            {label && (
                <EdgeLabelRenderer>
                <div
                    style={{
                    position: 'absolute',
                    transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                    fontSize: 12,
                    pointerEvents: 'all',
                    }}
                    className="nodrag nopan bg-white px-2 py-1 rounded shadow-sm border text-xs font-mono"
                >
                    {label}
                </div>
                </EdgeLabelRenderer>
            )}
            {/* Invisible wider path for easier clicking */}
            <path d={edgePath} strokeWidth={20} stroke="transparent" fill="none" className="react-flow__edge-interaction" />
        </>
    </EdgeContextMenu>
  );
}
