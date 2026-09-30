import { createRoot } from "react-dom/client";
import App from "./App";
import './index.css'
import { ThemeProvider } from "./context/ThemeProvider";
import { ProgressProvider } from "./context/ProgressProvider";
import { ConfirmProvider } from "./context/ConfirmProvider";

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <ThemeProvider>
      <ProgressProvider>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </ProgressProvider>
    </ThemeProvider>
  );
} else {
  throw new Error("Root element not found");
}
