import type { Translate } from "@deepseek-ai/dsh-client-ui-slots";
import type { TranslationKey } from "./i18n.js";
export declare const DEFAULT_TOGGLE_API_PREFIX = "/plugins/dsh-openviking-manager/api";
export interface OpenVikingToggleProps {
    sessionId: string;
    t: Translate<TranslationKey>;
    apiPrefix?: string;
    fetchFn?: typeof fetch;
}
export declare function OpenVikingToggle({ sessionId, t, apiPrefix, fetchFn }: OpenVikingToggleProps): import("react").JSX.Element;
