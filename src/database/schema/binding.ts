/** 玩家在某场游戏中的当前角色绑定。 */
export interface RDiceBinding {
  /** 自增主键。 */
  id: number;
  /** 所属游戏 ID。 */
  gameId: number;
  /** 玩家所在平台。 */
  platform: string;
  /** 玩家的平台内用户 ID。 */
  userId: string;
  /** 绑定到的角色卡 ID。 */
  characterId: number;
  /** 创建时间。 */
  createdAt: Date;
  /** 更新时间。 */
  updatedAt: Date;
}
