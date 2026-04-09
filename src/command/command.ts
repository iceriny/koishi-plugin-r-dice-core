import type { Context } from "koishi";
import { registerInitCommand } from "./registry/init";
import { registerRollCommand } from "./registry/roll";

export function registerCommand(ctx: Context) {
  const mainCommand = ctx.command("rd");

  // 下方调用注册子命令的函数
  registerInitCommand(mainCommand);
  registerRollCommand(ctx);
}
