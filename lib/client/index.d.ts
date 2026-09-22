import type { Context as ClientContext } from "@deepseek-ai/cordis";
import { type TranslationKey } from "./i18n.js";
import { ManagerForm } from "./manager-form.js";
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
export declare const inject: string[];
export declare function apply(ctx: ClientContext): void;
export { ManagerForm };
