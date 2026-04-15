import { Context, Schema } from "koishi";
import { applyDatabase } from "./database";
import DiceService from "./services";
import RDiceDatabaseService from "./services/database";
import RDiceObserverService from "./services/observer";
import { registerCommand } from "./command";

declare module "koishi" {
  interface Context {
    dice: DiceService;
    rdiceDb: RDiceDatabaseService;
    rdiceObserver: RDiceObserverService;
  }
}

export const name = "r-dice-core";
export const inject = ["database"];

export interface Config {}

export const Config: Schema<Config> = Schema.object({});

export function apply(ctx: Context, config: Config) {
  // 先注册数据库模型，再挂载服务与命令。
  applyDatabase(ctx);
  const diceService = new DiceService(ctx);
  const rdiceDbService = new RDiceDatabaseService(ctx);
  const rdiceObserverService = new RDiceObserverService(ctx, rdiceDbService);
  // 注册 服务实例到上下文
  ctx.set("dice", diceService);
  ctx.set("rdiceDb", rdiceDbService);
  ctx.set("rdiceObserver", rdiceObserverService);
  // 只有日志模式会真正进入观察者逻辑；其它频道会在作用域判定后直接放行。
  ctx.middleware(async (session, next) => {
    const shouldUseObserver = await rdiceObserverService.shouldUseObserver(session);
    if (!shouldUseObserver) {
      return next();
    }

    return next();
  }, true);
  // 使用 `middleware` 生命周期事件统一 flush，避免比外层插件的后置逻辑更早落库。
  ctx.on("middleware", async (session) => {
    await rdiceObserverService.flushSession(session);
  });
  // 注册命令
  registerCommand(ctx, rdiceDbService);
}
