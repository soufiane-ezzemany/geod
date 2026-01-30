import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { io, Socket } from "socket.io-client";
import { BACKEND_URL } from "@/config";

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

export function SocketProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  // Use state for socket so we can track when it's ready
  const [socket, setSocket] = useState<Socket | null>(null);

  // Create and connect socket once on mount
  useEffect(() => {
    const newSocket = io(BACKEND_URL);

    newSocket.on("connect", () => {
      console.log("Socket connected to backend");
      setIsConnected(true);
    });

    newSocket.on("disconnect", () => {
      console.log("Socket disconnected from backend");
      setIsConnected(false);
    });

    newSocket.on("connect_error", (err) => {
      console.error("Socket connection error:", err.message);
    });

    // Set socket after listeners are attached
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const value = useMemo(() => ({ socket, isConnected }), [socket, isConnected]);

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}
