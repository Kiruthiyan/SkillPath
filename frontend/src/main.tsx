import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@/api";
import App from "./App";
import "./index.css";

if (import.meta.env.VITE_API_URL) {
  setBaseUrl(import.meta.env.VITE_API_URL);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
