/** Identifies messages the official OpenViking memory plugin injects through
 * the `agent/pre-step` waterfall. Mirrors `OPENVIKING_PLUGIN_SOURCE` and the
 * `source.kind === "plugin"` tagging in @openviking/dsh-memory-plugin
 * (runtime.mjs pluginMessage / capture.mjs). */
export declare const OPENVIKING_PLUGIN_SOURCE = "openviking-memory";
export interface MaybeSourcedMessage {
    source?: {
        kind?: string;
        plugin?: string;
    } | undefined;
}
export declare function isOpenVikingInjectedMessage(message: MaybeSourcedMessage): boolean;
export declare function stripOpenVikingInjectedMessages<T extends MaybeSourcedMessage>(messages: readonly T[]): T[];
