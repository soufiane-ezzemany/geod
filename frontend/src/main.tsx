import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

import { ErrorBoundary } from "./components/error-boundary";
import { SocketProvider } from "./context/socket-context";
import { MetricsProvider } from "./hooks/useMetrics";
import AppRoutes from "./routes";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <SocketProvider>
        <MetricsProvider>
          <AppRoutes />
        </MetricsProvider>
      </SocketProvider>
    </ErrorBoundary>
  </StrictMode>,
);
