import type { Command, Session } from "koishi";
import type RDiceDatabaseService from "../../services/database";
import type { RDiceRule } from "../../types/common";

/** 当前阶段允许初始化的规则列表。 */
const VALID_RULES: RDiceRule[] = ["dnd", "coc"];

/** 规范化规则名输入。 */
function normalizeRuleName(rule: string | undefined): string {
  return rule?.trim().toLowerCase() ?? "";
}

/**
 * 处理频道初始化命令，并将规则配置写入数据库。
 * @param ctx Koishi 上下文
 * @param session 当前会话
 * @param rule 规则名称
 */
async function handleInitCommand(
  rdiceDbService: RDiceDatabaseService,
  session: Session,
  rule: string,
) {
  if (!session)
    return "出现未知错误 session is undefined <registerInitCommand>";

  const normalizedRule = normalizeRuleName(rule);
  if (!normalizedRule) {
    return `请指定游戏规则。可用规则：${VALID_RULES.join(", ")}`;
  }
  if (!VALID_RULES.includes(normalizedRule as RDiceRule)) {
    return `无效的游戏规则。可用规则：${VALID_RULES.join(", ")}`;
  }
  if (!session.platform || !session.channelId) {
    return "无法获取当前频道信息，无法初始化。";
  }

  const currentChannel = await rdiceDbService.getChannel(
    session.platform,
    session.channelId,
  );
  if (currentChannel?.logOn) {
    return "当前频道正在记录日志，暂时不能重新初始化规则，请先关闭日志。";
  }

  // 初始化阶段只落频道配置，不处理观察者与其它副作用。
  const ruleConfig = rdiceDbService.getDefaultRuleConfig(normalizedRule as RDiceRule);
  await rdiceDbService.upsertChannelConfig(session.platform, session.channelId, {
    guildId: session.guildId ?? null,
    rule: ruleConfig,
  });

  if (!currentChannel) {
    return `当前频道已初始化为 ${ruleConfig.rule}（版本 ${ruleConfig.version}，默认骰 d${ruleConfig.defaultDice}）。`;
  }

  if (
    currentChannel.rule.rule === ruleConfig.rule &&
    currentChannel.rule.version === ruleConfig.version &&
    currentChannel.rule.defaultDice === ruleConfig.defaultDice
  ) {
    return `当前频道已经是 ${ruleConfig.rule}（版本 ${ruleConfig.version}，默认骰 d${ruleConfig.defaultDice}），无需重复初始化。`;
  }

  return `当前频道规则已从 ${currentChannel.rule.rule}（版本 ${currentChannel.rule.version}）切换为 ${ruleConfig.rule}（版本 ${ruleConfig.version}，默认骰 d${ruleConfig.defaultDice}）。`;
}

/** 注册初始化命令。 */
export function registerInitCommand(
  mainCommand: Command,
  rdiceDbService: RDiceDatabaseService,
) {
  mainCommand
    .subcommand(".init [rule:string]", "设置游戏规则.")
    .usage("用法：rd.init [规则]")
    .example("rd.init dnd")
    .example("rd.init coc")
    .action(async ({ session }, rule) => {
      return session ? handleInitCommand(rdiceDbService, session, rule) : undefined;
    });
}
