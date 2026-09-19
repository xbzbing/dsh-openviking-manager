import { createRoot } from "react-dom/client";
import { ManagerForm } from "./manager-form.js";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root mount element");
createRoot(root).render(<ManagerForm />);
