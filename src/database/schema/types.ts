import type { RDiceRule, RDiceRuleConfig } from "../../types/common";

/** r-dice-core 使用的全部表名常量。 */
export const RDICE_TABLES = {
  channel: "rdice_channel",
  game: "rdice_game",
  character: "rdice_character",
  binding: "rdice_binding",
  log: "rdice_log",
} as const;

/** 游戏状态。 */
export type RDiceGameStatus = "active" | "paused" | "archived";

/** 日志类型。 */
export type RDiceLogType = "rp" | "action" | "ooc";

/** 角色卡归属或行为发起者的最小身份描述。 */
export interface RDicePlatformUser {
  platform: string;
  userId: string;
}

/** 角色卡使用的规则引用。 */
export interface RDiceRuleRef {
  rule: RDiceRule;
  version: string;
}

/** 角色卡 JSON 数据。 */
export type RDiceCharacterData = Record<string, unknown>;

/** 日志结构化负载。 */
export type RDiceLogPayload = Record<string, unknown>;

/** 频道主键生成器。 */
export function createChannelPrimaryId(platform: string, channelId: string): string {
  return `${platform}:${channelId}`;
}

/**
 * 获取规则配置的默认值。
 * 当前仅为初始化阶段提供合理起点，后续可由规则插件进一步覆盖。
 */
export function getDefaultRuleConfig(rule: RDiceRule): RDiceRuleConfig {
  if (rule === "coc") {
    return {
      rule,
      defaultDice: 100,
      version: "7th",
    };
  }

  return {
    rule,
    defaultDice: 20,
    version: "5e",
  };
}
