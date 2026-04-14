import { Context, Schema } from "koishi";
import { applyDatabase } from "./database";
import DiceService from "./services";
import RDiceDatabaseService from "./services/database";
import { registerCommand } from "./command";

declare module "koishi" {
  interface Context {
    dice: DiceService;
    rdiceDb: RDiceDatabaseService;
  }
}

export const name = "r-dice-core";

export interface Config {}

export const Config: Schema<Config> = Schema.object({});

export function apply(ctx: Context, config: Config) {
  // 先注册数据库模型，再挂载服务与命令。
  applyDatabase(ctx);
  // 注册 服务实例到上下文
  ctx.set("dice", new DiceService(ctx));
  ctx.set("rdiceDb", new RDiceDatabaseService(ctx));
  // 注册命令
  registerCommand(ctx);
}
