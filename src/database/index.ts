import type { Context } from "koishi";
import { defineRDiceDatabaseSchema } from "./schema/database";

export * from "./schema";

/** 注册 r-dice-core 的数据库表结构。 */
export function applyDatabase(ctx: Context) {
  defineRDiceDatabaseSchema(ctx);
}
