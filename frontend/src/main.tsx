import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

import { SocketProvider } from "./context/socket-context";
import { MetricsProvider } from "./hooks/useMetrics";
import AppRoutes from "./routes";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SocketProvider>
      <MetricsProvider>
        <AppRoutes />
      </MetricsProvider>
    </SocketProvider>
  </StrictMode>,
);
