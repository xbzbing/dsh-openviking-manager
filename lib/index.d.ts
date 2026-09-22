import type { Context } from "@deepseek-ai/cordis";
export declare const name = "openviking-manager";
export declare const inject: string[];
/** Mounts manager routes and a session-scoped OpenViking policy. The runtime
 * gate is installed synchronously; the later pre-step filter only defends
 * against version drift or an already-queued official injection. */
export declare function apply(ctx: Context): void;
