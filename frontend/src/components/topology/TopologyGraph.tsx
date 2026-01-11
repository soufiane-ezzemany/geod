import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
} from 'reactflow';
import type { Edge, Node, Connection } from 'reactflow';
import 'reactflow/dist/style.css';
import { io, Socket } from 'socket.io-client';
import AgentNode from './nodes/AgentNode';
import CustomEdge from './CustomEdge';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const nodeTypes = {
  agent: AgentNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

const TopologyGraph = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Define actions using useCallback to keep reference stable
  const handleNodeAction = useCallback((action: string, nodeId: string, params?: any) => {
    if (!socket) return;
    
    console.log(`Node Action: ${action} on ${nodeId}`, params);

    if (action === 'restart') {
        // Example: socket.emit('trigger_command', { target_hostname: nodeId, command: 'restart' });
        toast.info(`Restarting ${nodeId}...`);
    } else if (action === 'ping') {
        socket.emit('trigger_command', { 
            target_hostname: nodeId, 
            command: 'ping',
            params: { target: '8.8.8.8', count: 4 }
        });
        toast.info(`Pinging from ${nodeId}...`);
    } else if (action === 'details') {
        toast.info(`Agent: ${nodeId}`);
    }
  }, [socket]);

  const handleEdgeAction = useCallback((action: string, _edgeId: string, source: string, target: string, params?: any) => {
    if (!socket) return;
    
    console.log(`Edge Action: ${action} on ${source}->${target}`, params);

    if (action === 'bandwidth') {
        // Send command to source agent to limit outgoing traffic on the relevant interface
        // For MVP, we send to source and hope it knows the interface or applies globally
        // Ideally, we'd look up the interface IP matching the target IP.
        socket.emit('trigger_command', { 
            target_hostname: source, 
            command: 'bandwidth_limit',
            params: { 
                interface: 'eth0', // Hardcoded for prototype; needs dynamic interface lookup
                limit: params.limit 
            }
        });
        if (params.limit === 'unset') {
             toast.success(`Removed bandwidth limit between ${source} and ${target}`);
        } else {
             toast.success(`Set bandwidth limit to ${params.limit} between ${source} and ${target}`);
        }
    } else if (action === 'iperf') {
        // 1. Start Server on Target
        socket.emit('trigger_command', {
            target_hostname: target,
            command: 'start_iperf_server',
            params: {}
        });
        
        toast.info(`Starting Iperf Server on ${target}...`);

        // 2. Start Client on Source (after short delay)
        setTimeout(() => {
            socket.emit('trigger_command', {
                target_hostname: source,
                command: 'run_iperf_client',
                params: { 
                    target: target, // Assuming DNS/hosts resolves this, otherwise we need IP
                    duration: params.duration || 10
                }
            });
            toast.success(`Started Iperf Client on ${source} -> ${target}`);
        }, 1000);

    } else if (action === 'latency') {
        // TC netem for latency
        // socket.emit(...)
        toast.info(`Set latency to ${params.delay}`);
    }
  }, [socket]);

  // Initialize Socket
  useEffect(() => {
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to backend');
      // Request initial topology
      fetch('http://localhost:5000/api/topology')
        .then(res => res.json())
        .then(data => processTopologyData(data));
    });

    newSocket.on('disconnect', () => setIsConnected(false));

    newSocket.on('topology_update', (data) => {
        processTopologyData(data);
    });

    newSocket.on('network_stats_update', (data) => {
        setNodes((nds) => nds.map((node) => {
            if (node.id === data.hostname) {
                return {
                    ...node,
                    data: { ...node.data, stats: data.stats }
                };
            }
            return node;
        }));
    });

    newSocket.on('link_stats_update', (data) => {
        setEdges((eds) => eds.map((edge) => {
            if (edge.source === data.source && edge.target === data.target) {
                return {
                    ...edge,
                    label: `${data.latency}ms`,
                    animated: true,
                    style: { stroke: determineLinkColor(data.latency) }
                };
            }
            return edge;
        }));
    });

    return () => {
      newSocket.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // We need to wrap processTopologyData to access the handlers
  // But handlers depend on socket which changes. 
  // Better to store handlers in a ref or use the effect deps properly.
  // Actually, standard practice is to put handlers in the data object.
  // We need to re-process nodes if handlers change? No, just pass the stable function.
  
  // Since processTopologyData is called from socket callback, it captures the closure.
  // We'll make it a useCallback that depends on handlers.
  
  const processTopologyData = useCallback((data: any) => {
      if (!data.nodes) return;

      const newNodes: Node[] = data.nodes.map((n: any, index: number) => ({
          id: n.id,
          type: 'agent',
          position: { x: 100 + (index * 250), y: 100 + (index % 2 * 100) },
          data: { 
              label: n.id, 
              ip: n.ip || 'Unknown', 
              os: n.os || 'Linux',
              stats: null,
              onAction: handleNodeAction 
          },
      }));

      const newEdges: Edge[] = data.links.map((l: any) => ({
          id: `${l.source}-${l.target}`,
          source: l.source,
          target: l.target,
          type: 'custom', // Use our custom edge
          label: l.latency ? `${l.latency}ms` : 'Connecting...',
          animated: true,
          style: { stroke: '#94a3b8' },
          markerEnd: { type: MarkerType.ArrowClosed },
          data: {
              onAction: handleEdgeAction
          }
      }));
      
      setNodes((currentNodes) => {
          return newNodes.map(nn => {
              const existing = currentNodes.find(en => en.id === nn.id);
              if (existing) {
                  return { ...nn, position: existing.position, data: { ...nn.data, stats: existing.data.stats, onAction: handleNodeAction } };
              }
              return nn;
          });
      });
      
      setEdges(() => {
        return newEdges;
      });
  }, [handleNodeAction, handleEdgeAction, setNodes, setEdges]);


  const determineLinkColor = (latency: number) => {
      if (latency < 20) return '#22c55e'; // Green
      if (latency < 100) return '#eab308'; // Yellow
      return '#ef4444'; // Red
  };

  const onConnect = useCallback(
    (params: Connection) => {
        setEdges((eds) => addEdge({ ...params, type: 'custom', animated: true }, eds));
        
        const source = params.source;
        const target = params.target;
        if(source && target) {
             fetch('http://localhost:5000/api/topology')
                .then(res => res.json())
                .then(currentTopo => {
                    const newLink = { source, target, type: 'manual' };
                    const exists = currentTopo.links.find((l:any) => l.source === source && l.target === target);
                    if(!exists) {
                        currentTopo.links.push(newLink);
                        fetch('http://localhost:5000/api/topology', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify(currentTopo)
                        });
                    }
                });
        }
    },
    [setEdges]
  );

  return (
    <div className="w-full h-[calc(100vh-100px)] bg-slate-50 relative rounded-xl border overflow-hidden">
      {!isConnected && (
        <div className="absolute top-0 left-0 w-full h-1 bg-red-500 z-50 animate-pulse" />
      )}
      
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
        </Button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        className="bg-slate-50"
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
};

export default TopologyGraph;
