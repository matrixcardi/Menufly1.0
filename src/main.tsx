import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

console.log(`%cMenuFly v${__APP_VERSION__}`, "color:#f97316;font-weight:bold;font-size:14px");

createRoot(document.getElementById("root")!).render(<App />);
