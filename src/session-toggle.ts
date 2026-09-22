/** In-memory per-session OpenViking policy. A session is disabled only while
 * its id is present in the set. Step policies snapshot the live setting at
 * pre-step admission so a toggle only affects a later step. Neither map is
 * persisted: a dsh restart returns every session to the default (enabled). */

const disabledSessions = new Set<string>();
const activeStepPolicies = new Map<string, boolean>();

export function normalizeSessionId(sessionId: unknown): string | undefined {
  if (typeof sessionId !== "string") return undefined;
  const trimmed = sessionId.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function isSessionOpenVikingEnabled(sessionId: unknown): boolean {
  const id = normalizeSessionId(sessionId);
  if (id === undefined) return true;
  return !disabledSessions.has(id);
}

export function beginOpenVikingStep(sessionId: unknown): boolean {
  const id = normalizeSessionId(sessionId);
  if (id === undefined) return true;
  const enabled = !disabledSessions.has(id);
  activeStepPolicies.set(id, enabled);
  return enabled;
}

export function isOpenVikingEnabledForActiveStep(sessionId: unknown): boolean {
  const id = normalizeSessionId(sessionId);
  if (id === undefined) return true;
  return activeStepPolicies.get(id) ?? !disabledSessions.has(id);
}

export function endOpenVikingStep(sessionId: unknown): void {
  const id = normalizeSessionId(sessionId);
  if (id !== undefined) activeStepPolicies.delete(id);
}

export function setOpenVikingEnabled(sessionId: unknown, enabled: boolean): boolean {
  const id = normalizeSessionId(sessionId);
  if (id === undefined) return false;
  if (enabled) disabledSessions.delete(id);
  else disabledSessions.add(id);
  return true;
}
