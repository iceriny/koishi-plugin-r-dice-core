import type { RDiceLogPayload, RDiceLogType } from "./types";

/** 跑团日志实体。 */
export interface RDiceLog {
  /** 自增主键。 */
  id: number;
  /** 所属游戏 ID。 */
  gameId: number;
  /** 日志类型。 */
  type: RDiceLogType;
  /** 原始消息文本。 */
  message: string;
  /** 结构化日志负载。 */
  payload: RDiceLogPayload;
  /** 发言时的昵称或角色名快照。 */
  senderName: string;
  /** 发言者所在平台。 */
  platform: string;
  /** 发言者的平台内用户 ID。 */
  userId: string;
  /** 创建时间。 */
  createdAt: Date;
}
