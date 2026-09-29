import { createRoot } from "react-dom/client";
import App from "./App";
import './index.css'
import { ThemeProvider } from "./context/ThemeProvider";
import { ProgressProvider } from "./context/ProgressProvider";

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <ThemeProvider>
      <ProgressProvider>
        <App />
      </ProgressProvider>
    </ThemeProvider>
  );
} else {
  throw new Error("Root element not found");
}
