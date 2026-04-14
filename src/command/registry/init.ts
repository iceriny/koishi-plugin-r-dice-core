import type { Command, Context, Session } from "koishi";
import type { RDiceRule } from "../../types/common";

/**
 * 处理频道初始化命令，并将规则配置写入数据库。
 * @param ctx Koishi 上下文
 * @param session 当前会话
 * @param rule 规则名称
 */
async function handleInitCommand(
  ctx: Context,
  session: Session,
  rule: string,
) {
  if (!session)
    return "出现未知错误 session is undefined <registerInitCommand>";

  // 当前阶段先使用固定规则列表，后续再改为从规则插件注册表读取。
  const validRules: RDiceRule[] = ["dnd", "coc"];
  if (!rule) {
    return `请指定游戏规则。可用规则：${validRules.join(", ")}`;
  }
  if (!validRules.includes(rule as RDiceRule)) {
    return `无效的游戏规则。可用规则：${validRules.join(", ")}`;
  }
  if (!session.platform || !session.channelId) {
    return "无法获取当前频道信息，无法初始化。";
  }

  // 初始化阶段只落频道配置，不处理观察者与其它副作用。
  const ruleConfig = ctx.rdiceDb.getDefaultRuleConfig(rule as RDiceRule);
  await ctx.rdiceDb.upsertChannelConfig(session.platform, session.channelId, {
    guildId: session.guildId ?? null,
    rule: ruleConfig,
  });

  return `游戏规则已设置为 ${ruleConfig.rule}（版本 ${ruleConfig.version}，默认骰 d${ruleConfig.defaultDice}）！`;
}

/** 注册初始化命令。 */
export function registerInitCommand(ctx: Context, mainCommand: Command) {
  mainCommand
    .subcommand(".init [rule:string]", "设置游戏规则.")
    .usage("用法：rd.init [规则]")
    .example("rd.init dnd")
    .example("rd.init coc")
    .action(async ({ session }, rule) => {
      return session ? handleInitCommand(ctx, session, rule) : undefined;
    });
}
