import { BaseEdge, EdgeLabelRenderer, type EdgeProps, getBezierPath } from "reactflow";
import { EdgeContextMenu } from "./context-menus/EdgeContextMenu";
import type { TopologyLink } from "@/types/network";

const getLatencyColor = (latency?: number) => {
    if (latency === undefined || latency === null) return "text-slate-400";
    if (latency < 20) return "text-green-600";
    if (latency < 100) return "text-yellow-600";
    return "text-red-600";
};

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
  source,
  target,
}: EdgeProps) {
  // Use standard Bezier path, no offset needed for single edge
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const forward = data?.forward as TopologyLink | undefined;
  const backward = data?.backward as TopologyLink | undefined;
  const isOnline = data?.isNodesOnline;

  const renderLinkStatus = (link?: TopologyLink) => {
      if (!link) return <span className="text-slate-300">-</span>;
      if (link.monitoring === false) return <span className="text-slate-400">Paused</span>;
      if (!isOnline) return <span className="text-slate-400">Offline</span>;
      
      return (
          <span className={`font-mono font-medium ${getLatencyColor(link.latency)}`}>
            {link.latency ? `${link.latency}ms` : "..."}
          </span>
      );
  };

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      {/* Invisible wider path for interaction */}
      <path
        d={edgePath}
        strokeWidth={20}
        stroke="transparent"
        fill="none"
        style={{ pointerEvents: "none" }}
        className="react-flow__edge-interaction"
      />
      <EdgeLabelRenderer>
        <EdgeContextMenu 
            edgeId={id} 
            source={source} 
            target={target}
            data={data} // Pass unified data
            onAction={data?.onAction}
        >
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className="nodrag nopan bg-white/90 backdrop-blur border shadow-sm rounded-md px-2 py-1 flex flex-col items-center gap-0.5 text-[10px] cursor-context-menu hover:bg-white hover:shadow-md transition-all"
          >
             {/* Forward Row (Source -> Target) */}
             <div className="flex items-center gap-1 w-full justify-between min-w-[60px]">
                <span className="text-slate-400">→</span>
                {renderLinkStatus(forward)}
             </div>
             
             {/* Separator */}
             <div className="w-full h-[1px] bg-slate-100" />

             {/* Backward Row (Target -> Source) */}
             <div className="flex items-center gap-1 w-full justify-between min-w-[60px]">
                <span className="text-slate-400">←</span>
                {renderLinkStatus(backward)}
             </div>
          </div>
        </EdgeContextMenu>
      </EdgeLabelRenderer>
    </>
  );
}
