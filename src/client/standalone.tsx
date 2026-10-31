import { createRoot } from "react-dom/client";
import { ManagerForm } from "./manager-form.js";
import { OpenVikingInputSlot } from "./ov-toggle.js";
import { browserLocale, createTranslation, type TranslationKey } from "./i18n.js";
import type { Translate } from "@deepseek-ai/dsh-client-ui-slots";
import { installManagerStyles } from "./styles.js";

installManagerStyles();

const t = createTranslation(browserLocale()) as Translate<TranslationKey>;
const root = document.getElementById("root");
if (!root) throw new Error("Missing #root mount element");
createRoot(root).render(
  <>
    <div className="ovm-standaloneToggle">
      <OpenVikingInputSlot sessionId="standalone-session" t={t} />
    </div>
    <ManagerForm t={t} />
  </>,
);
