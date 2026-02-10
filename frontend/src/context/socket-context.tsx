import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { io, Socket } from "socket.io-client";
import { BACKEND_URL } from "@/config";
import { socketLogger } from "@/lib/logger";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

// eslint-disable-next-line react-refresh/only-export-components
export function useSocket() {
  return useContext(SocketContext);
}

// Create socket outside component to avoid recreating on re-renders
// This is a singleton pattern for socket.io
let socketInstance: Socket | null = null;

function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io(BACKEND_URL, {
      // Allow both WebSocket and polling for fallback
      transports: ["websocket", "polling"],
      // Reconnection settings for Grid5000 network conditions
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });
  }
  return socketInstance;
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket] = useState<Socket>(() => getSocket());
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const handleConnect = () => {
      socketLogger.info("Connected to backend");
      setIsConnected(true);
    };

    const handleDisconnect = () => {
      socketLogger.info("Disconnected from backend");
      setIsConnected(false);
    };

    const handleError = (err: Error) => {
      socketLogger.error("Connection error:", err.message);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleError);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleError);
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}
