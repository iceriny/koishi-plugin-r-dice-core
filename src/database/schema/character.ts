import type { RDiceCharacterData, RDiceRuleRef } from "./types";

/** 角色卡实体。 */
export interface RDiceCharacter {
  /** 自增主键。 */
  id: number;
  /** 角色所属平台。 */
  platform: string;
  /** 角色所属用户的平台内 ID。 */
  userId: string;
  /** 角色名。 */
  name: string;
  /** 角色卡所属规则与版本。 */
  rule: RDiceRuleRef;
  /** 规则侧负责解释的角色数据。 */
  data: RDiceCharacterData;
  /** 创建时间。 */
  createdAt: Date;
  /** 更新时间。 */
  updatedAt: Date;
}
