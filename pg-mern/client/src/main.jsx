import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
if ("serviceWorker" in navigator && import.meta.env.PROD) addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
createRoot(document.getElementById("root")).render(<App />);
