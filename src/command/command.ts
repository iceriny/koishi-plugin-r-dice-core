import type { Context } from "koishi";
import type RDiceDatabaseService from "../services/database";
import { registerInitCommand } from "./registry/init";
import { registerLogCommand } from "./registry/log";
import { registerRollCommand } from "./registry/roll";

/** 注册 r-dice-core 的命令。 */
export function registerCommand(
  ctx: Context,
  rdiceDbService: RDiceDatabaseService,
) {
  const mainCommand = ctx.command("rd");

  // 下方调用注册子命令的函数
  registerInitCommand(mainCommand, rdiceDbService);
  registerLogCommand(ctx, rdiceDbService);
  registerRollCommand(ctx, rdiceDbService);
}
