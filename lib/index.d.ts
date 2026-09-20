import type { Context } from "@deepseek-ai/cordis";
export declare const name = "openviking-manager";
export declare const inject: string[];
/**
 * Mounts manager-only same-origin routes. This plugin never mounts memory tools
 * or alters @openviking/dsh-memory-plugin behavior.
 */
export declare function apply(ctx: Context): void;
