import type { RDiceRuleConfig } from "../../types/common";

/** 频道级配置与运行状态。 */
export interface RDiceChannel {
  /** 内部主键，建议使用 `${platform}:${channelId}`。 */
  id: string;
  /** 平台标识。 */
  platform: string;
  /** 平台内频道或群组 ID。 */
  channelId: string;
  /** 频道所属 guild，可空以兼容不同平台。 */
  guildId: string | null;
  /** 当前频道启用的规则配置。 */
  rule: RDiceRuleConfig;
  /** 当前频道是否正在记录日志。 */
  logOn: boolean;
  /** 当前频道正在进行中的游戏 ID。 */
  activeGameId: number | null;
  /** 创建时间。 */
  createdAt: Date;
  /** 更新时间。 */
  updatedAt: Date;
}