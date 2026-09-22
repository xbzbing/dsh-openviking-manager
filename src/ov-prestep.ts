/** Identifies messages the official OpenViking memory plugin injects through
 * the `agent/pre-step` waterfall. Mirrors `OPENVIKING_PLUGIN_SOURCE` and the
 * `source.kind === "plugin"` tagging in @openviking/dsh-memory-plugin
 * (runtime.mjs pluginMessage / capture.mjs). */

export const OPENVIKING_PLUGIN_SOURCE = "openviking-memory";

export interface MaybeSourcedMessage {
  source?: { kind?: string; plugin?: string } | undefined;
}

export function isOpenVikingInjectedMessage(message: MaybeSourcedMessage): boolean {
  return message?.source?.kind === "plugin" && message.source.plugin === OPENVIKING_PLUGIN_SOURCE;
}

export function stripOpenVikingInjectedMessages<T extends MaybeSourcedMessage>(
  messages: readonly T[],
): T[] {
  return messages.filter((message) => !isOpenVikingInjectedMessage(message));
}
