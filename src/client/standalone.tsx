import { createRoot } from "react-dom/client";
import { ManagerForm } from "./manager-form.js";
import { browserLocale, createTranslation } from "./i18n.js";
import { installManagerStyles } from "./styles.js";

installManagerStyles();

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root mount element");
createRoot(root).render(<ManagerForm t={createTranslation(browserLocale())} />);
