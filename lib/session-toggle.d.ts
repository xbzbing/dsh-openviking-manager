/** In-memory per-session OpenViking policy. A session is disabled only while
 * its id is present in the set. Step policies snapshot the live setting at
 * pre-step admission so a toggle only affects a later step. Neither map is
 * persisted: a dsh restart returns every session to the default (enabled). */
export declare function normalizeSessionId(sessionId: unknown): string | undefined;
export declare function isSessionOpenVikingEnabled(sessionId: unknown): boolean;
export declare function beginOpenVikingStep(sessionId: unknown): boolean;
export declare function isOpenVikingEnabledForActiveStep(sessionId: unknown): boolean;
export declare function endOpenVikingStep(sessionId: unknown): void;
export declare function setOpenVikingEnabled(sessionId: unknown, enabled: boolean): boolean;
