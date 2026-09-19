import type { Context as ClientContext } from "@deepseek-ai/cordis";
import type {} from "@deepseek-ai/dsh-client-ui-renderer/client";
import type {} from "@deepseek-ai/dsh-client-ui-slots";
import type { PluginConfigViewProps } from "@deepseek-ai/dsh-client-ui-plugin-manager/client";
import { ManagerForm } from "./manager-form.js";

export const inject = ["slots"];

const css = `
.ovm-shell{max-width:760px;padding:28px;color:var(--dsw-alias-label-primary,#202124);font-family:ui-sans-serif,system-ui,sans-serif}.ovm-eyebrow{color:#2f6f5e;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}.ovm-shell h1{margin:4px 0 10px;font-size:28px;letter-spacing:-.03em}.ovm-intro{max-width:620px;color:var(--dsw-alias-label-secondary,#59636e);line-height:1.65}.ovm-card{margin-top:24px;border:1px solid var(--dsw-alias-border-l2,#dce1e6);border-radius:12px;background:var(--dsw-alias-bg-layer-2,#fff);padding:20px}.ovm-status{margin-bottom:16px;color:#365b4f;font-size:13px}.ovm-warning{display:flex;align-items:center;justify-content:space-between;gap:12px;border-left:3px solid #b47d1f;background:#fff8e8;padding:12px;color:#664500;font-size:13px}.ovm-warning button{background:#fff;border:1px solid #b47d1f;color:#664500}form{display:grid;gap:14px;margin-top:18px}label{display:grid;gap:6px;color:var(--dsw-alias-label-primary,#202124);font-size:13px;font-weight:600}input{height:36px;border:1px solid var(--dsw-alias-border-l2,#ccd3da);border-radius:7px;padding:0 10px;background:transparent;color:inherit;font:inherit;font-weight:400}.ovm-optional,.ovm-hint{color:var(--dsw-alias-label-tertiary,#77818b);font-weight:400}.ovm-hint{margin:0;font-size:12px;line-height:1.5}.ovm-actions{display:flex;align-items:center;gap:14px;margin-top:8px}.ovm-actions button,.ovm-actions a{border-radius:7px;padding:8px 13px;font:inherit;font-size:13px;text-decoration:none}.ovm-actions button{border:0;background:#1f4038;color:#fff}.ovm-actions a{color:#1f5d50}.ovm-actions button:disabled{opacity:.55}
`;

if (typeof document !== "undefined" && document.querySelector("style[data-plugin='dsh-openviking-manager']") === null) {
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-openviking-manager";
  tag.textContent = css;
  document.head.appendChild(tag);
}

export function apply(ctx: ClientContext): void {
  ctx.slots.inject("plugins.bundle.config", () =>
    ctx.slots.register(
      { name: "plugins.bundle.config", key: "dsh-openviking-manager" },
      (props: PluginConfigViewProps) => (props.view === "summary" ? "OpenViking connection configuration and local diagnostics." : <ManagerForm />),
    ),
  );
}

export { ManagerForm };
