import type { Context } from "koishi";
import { registerInitCommand } from "./registry/init";
import { registerRollCommand } from "./registry/roll";

/** 注册 r-dice-core 的命令。 */
export function registerCommand(ctx: Context) {
  const mainCommand = ctx.command("rd");

  // 下方调用注册子命令的函数
  registerInitCommand(ctx, mainCommand);
  registerRollCommand(ctx);
}
