import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

import { MetricsProvider } from "./hooks/useMetrics";
import AppRoutes from "./routes";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MetricsProvider>
      <AppRoutes />
    </MetricsProvider>
  </StrictMode>
);
