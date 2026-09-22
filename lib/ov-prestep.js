/** Identifies messages the official OpenViking memory plugin injects through
 * the `agent/pre-step` waterfall. Mirrors `OPENVIKING_PLUGIN_SOURCE` and the
 * `source.kind === "plugin"` tagging in @openviking/dsh-memory-plugin
 * (runtime.mjs pluginMessage / capture.mjs). */
export const OPENVIKING_PLUGIN_SOURCE = "openviking-memory";
export function isOpenVikingInjectedMessage(message) {
    return message?.source?.kind === "plugin" && message.source.plugin === OPENVIKING_PLUGIN_SOURCE;
}
export function stripOpenVikingInjectedMessages(messages) {
    return messages.filter((message) => !isOpenVikingInjectedMessage(message));
}
