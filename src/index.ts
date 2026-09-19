import type { Context } from "@deepseek-ai/cordis";
import type {} from "@deepseek-ai/dsh-host-webserver";
import { makeManagerRoutes } from "./manager-api.js";

export const name = "openviking-manager";
export const inject = ["webServer"];

/**
 * Mounts manager-only same-origin routes. This plugin never mounts memory tools
 * or alters @openviking/dsh-memory-plugin behavior.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => {
    const disposers = makeManagerRoutes().map((route) => ctx.webServer.register(route));
    return () => {
      for (const dispose of disposers) dispose();
    };
  }, "openviking-manager: API routes");
}
