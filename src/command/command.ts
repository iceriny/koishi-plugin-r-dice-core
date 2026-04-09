import type { Context } from "koishi";
import { registerInitCommand } from "./registry/init";

export function registerCommand(ctx: Context) {
  const mainCommand = ctx.command("rd");

  // 下方调用注册子命令的函数
  registerInitCommand(mainCommand);
}
