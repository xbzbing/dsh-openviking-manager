import type { Context as ClientContext } from "@deepseek-ai/cordis";
import type {} from "@deepseek-ai/dsh-client-ui-renderer/client";
import type {} from "@deepseek-ai/dsh-client-ui-slots";
import type {} from "@deepseek-ai/dsh-client-locale/client";
import type { PluginConfigViewProps } from "@deepseek-ai/dsh-client-ui-plugin-manager/client";
import type { Translate } from "@deepseek-ai/dsh-client-ui-slots";
import { dictionaries, type TranslationKey } from "./i18n.js";
import { ManagerForm } from "./manager-form.js";
import { OpenVikingToggle } from "./ov-toggle.js";
import { installManagerStyles } from "./styles.js";

declare module "@deepseek-ai/dsh-client-ui-slots" {
  interface LocaleNamespaceMap {
    "openviking-manager": TranslationKey;
  }
}

declare module "@deepseek-ai/dsh-client-ui-slots" {
  interface SlotMap {
    "conversation.input.left": {
      kind: "list";
      scope: "session";
    };
  }
}

interface ManagerConfigProps extends PluginConfigViewProps {
  t: Translate<TranslationKey>;
}

export const inject = ["slots", "locale"];

installManagerStyles();

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register("openviking-manager", dictionaries), "openviking-manager: dictionaries");
  ctx.slots.inject("plugins.bundle.config", () =>
    ctx.slots.register(
      { name: "plugins.bundle.config", key: "dsh-openviking-manager", locale: "openviking-manager" as const },
      (props: ManagerConfigProps) => (props.view === "summary" ? props.t("summary") : <ManagerForm t={props.t} />),
    ),
  );
  ctx.slots.inject("conversation.input.left", () =>
    ctx.slots.register(
      {
        name: "conversation.input.left",
        id: "openviking-toggle",
        order: 10,
        locale: "openviking-manager" as const,
        registrant: "dsh-openviking-manager",
        inject: (sessionId: string) => ({ sessionId }),
      },
      OpenVikingToggle,
    ),
  );
}

export { ManagerForm };
