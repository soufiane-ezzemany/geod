import { BaseEdge, EdgeLabelRenderer, type EdgeProps, getBezierPath } from "reactflow";
import { EdgeContextMenu } from "./context-menus/EdgeContextMenu";

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
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      {/* Invisible wider path for easier clicking (but don't block label pointer events) */}
      <path
        d={edgePath}
        strokeWidth={20}
        stroke="transparent"
        fill="none"
        style={{ pointerEvents: "none" }}
        className="react-flow__edge-interaction"
      />
      <EdgeLabelRenderer>
        <EdgeContextMenu edgeId={id} source={source} target={target} onAction={data?.onAction}>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 12,
              pointerEvents: "all",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
            className="nodrag nopan bg-white px-2 py-1 rounded shadow-sm border text-xs font-mono cursor-context-menu hover:bg-slate-50"
          >
            {/* Show a small spinner when edge is pending (optimistic remove/add) */}
            {data?.pending ? (
              <svg
                className="animate-spin h-3 w-3 text-slate-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                ></path>
              </svg>
            ) : null}
            <span>{label || "•••"}</span>
          </div>
        </EdgeContextMenu>
      </EdgeLabelRenderer>
    </>
  );
}
