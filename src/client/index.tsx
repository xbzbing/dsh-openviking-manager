import type { Context as ClientContext } from "@deepseek-ai/cordis";
import type {} from "@deepseek-ai/dsh-client-ui-renderer/client";
import type {} from "@deepseek-ai/dsh-client-ui-slots";
import type { PluginConfigViewProps } from "@deepseek-ai/dsh-client-ui-plugin-manager/client";
import { ManagerForm } from "./manager-form.js";
import { installManagerStyles } from "./styles.js";

export const inject = ["slots"];

installManagerStyles();

export function apply(ctx: ClientContext): void {
  ctx.slots.inject("plugins.bundle.config", () =>
    ctx.slots.register(
      { name: "plugins.bundle.config", key: "dsh-openviking-manager" },
      (props: PluginConfigViewProps) => (props.view === "summary" ? "OpenViking connection configuration and local diagnostics." : <ManagerForm />),
    ),
  );
}

export { ManagerForm };
