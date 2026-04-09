import { Context, Schema } from "koishi";
import DiceService from "./services";
import { registerCommand } from "./command";

declare module "koishi" {
  interface Context {
    dice: DiceService;
  }
}

export const name = "r-dice-core";

export interface Config {}

export const Config: Schema<Config> = Schema.object({});

export function apply(ctx: Context, config: Config) {
  // 注册 服务实例到上下文
  ctx.set("dice", new DiceService(ctx));
  // 注册命令
  registerCommand(ctx);
}
