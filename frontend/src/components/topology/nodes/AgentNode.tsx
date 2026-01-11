import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Server, MonitorCheck, Wifi } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { NodeContextMenu } from '../context-menus/NodeContextMenu';

const AgentNode = ({ data, id }: { data: any, id: string }) => {
  return (
    <div className="relative">
        <NodeContextMenu nodeId={id} onAction={data.onAction}>
            <Card className="w-64 border-2 border-primary/20 shadow-lg bg-background/95 backdrop-blur cursor-context-menu">
            <CardHeader className="p-3 pb-1">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Server className="w-4 h-4 text-primary" />
                        {data.label}
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] h-5 bg-green-500/10 text-green-600 border-green-200">
                        Online
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-3 pt-2 text-xs text-muted-foreground space-y-1">
                <div className="flex items-center gap-2">
                    <Wifi className="w-3 h-3" />
                    <span>{data.ip}</span>
                </div>
                <div className="flex items-center gap-2">
                    <MonitorCheck className="w-3 h-3" />
                    <span>{data.os}</span>
                </div>
                {data.stats && (
                    <div className="mt-2 pt-2 border-t grid grid-cols-2 gap-2">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-semibold text-foreground">CPU</span>
                            <span>{data.stats.system?.cpu_percent}%</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-semibold text-foreground">RAM</span>
                            <span>{data.stats.system?.memory?.percent}%</span>
                        </div>
                    </div>
                )}
            </CardContent>
            </Card>
        </NodeContextMenu>
        
        <Handle type="target" position={Position.Top} className="w-3 h-3 bg-primary z-50" />
        <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-primary z-50" />
    </div>
  );
};

export default memo(AgentNode);
