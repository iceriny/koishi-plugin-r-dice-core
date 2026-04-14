import type { RDiceGameStatus } from "./types";

/** 游戏或日志会话实体。 */
export interface RDiceGame {
  /** 自增主键。 */
  id: number;
  /** 所属频道主键。 */
  channelId: string;
  /** 游戏或日志名。 */
  name: string;
  /** 当前状态。 */
  status: RDiceGameStatus;
  /** GM 所在平台。 */
  gmPlatform: string | null;
  /** GM 的平台内用户 ID。 */
  gmUserId: string | null;
  /** 创建时间。 */
  createdAt: Date;
  /** 更新时间。 */
  updatedAt: Date;
  /** 归档时间。 */
  archivedAt: Date | null;
}
