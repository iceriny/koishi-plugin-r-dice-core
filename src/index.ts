import { Context, Schema } from "koishi";
import DiceService from "./services";

declare module "koishi" {
  interface Context {
    dice: DiceService;
  }
}

export const name = "r-dice-core";

export interface Config {}

export const Config: Schema<Config> = Schema.object({});

export function apply(ctx: Context, config: Config) {
  ctx.set("dice", new DiceService(ctx));
}
