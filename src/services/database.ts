import { $, type Context, Service } from "koishi";
import type { RDiceRule, RDiceRuleConfig } from "../types/common";
import {
  RDICE_TABLES,
  createChannelPrimaryId,
  getDefaultRuleConfig,
  type RDiceBinding,
  type RDiceChannel,
  type RDiceCharacter,
  type RDiceCharacterData,
  type RDiceGame,
  type RDiceGameStatus,
  type RDiceLog,
  type RDiceLogPayload,
  type RDiceLogType,
  type RDicePlatformUser,
  type RDiceRuleRef,
} from "../database";

/** 频道配置补丁。 */
export interface RDiceChannelConfigPatch {
  guildId?: string | null;
  rule?: RDiceRuleConfig;
  logOn?: boolean;
  activeGameId?: number | null;
}

/** 创建游戏输入。 */
export interface CreateRDiceGameInput {
  channelId: string;
  name: string;
  status?: RDiceGameStatus;
  gm?: RDicePlatformUser | null;
}

/** 创建角色卡输入。 */
export interface CreateRDiceCharacterInput extends RDicePlatformUser {
  name: string;
  rule: RDiceRuleRef;
  data?: RDiceCharacterData;
}

/** 创建日志输入。 */
export interface CreateRDiceLogInput extends RDicePlatformUser {
  gameId: number;
  type: RDiceLogType;
  message: string;
  senderName: string;
  payload?: RDiceLogPayload;
}

/** r-dice-core 的轻量数据库服务。 */
export default class RDiceDatabaseService extends Service {
  constructor(ctx: Context) {
    super(ctx, "rdiceDb");
  }

  /** 获取频道主键。 */
  public createChannelPrimaryId(platform: string, channelId: string): string {
    return createChannelPrimaryId(platform, channelId);
  }

  /** 获取某个规则的默认配置。 */
  public getDefaultRuleConfig(rule: RDiceRule): RDiceRuleConfig {
    return getDefaultRuleConfig(rule);
  }

  /** 按平台与频道 ID 获取频道配置。 */
  public async getChannel(
    platform: string,
    channelId: string,
  ): Promise<RDiceChannel | null> {
    const rows = await this.ctx.database.get(
      RDICE_TABLES.channel,
      createChannelPrimaryId(platform, channelId),
    );
    return rows[0] ?? null;
  }

  /**
   * 创建或更新频道配置。
   * 当频道不存在时，会按默认规则配置创建初始记录。
   */
  public async upsertChannelConfig(
    platform: string,
    channelId: string,
    patch: RDiceChannelConfigPatch,
  ): Promise<RDiceChannel> {
    const id = createChannelPrimaryId(platform, channelId);
    const now = new Date();
    const existed = await this.getChannel(platform, channelId);
    const next: RDiceChannel = {
      id,
      platform,
      channelId,
      guildId:
        Object.prototype.hasOwnProperty.call(patch, "guildId")
          ? patch.guildId ?? null
          : existed?.guildId ?? null,
      rule:
        Object.prototype.hasOwnProperty.call(patch, "rule") && patch.rule
          ? patch.rule
          : existed?.rule ?? getDefaultRuleConfig("dnd"),
      logOn:
        Object.prototype.hasOwnProperty.call(patch, "logOn") && patch.logOn !== undefined
          ? patch.logOn
          : existed?.logOn ?? false,
      activeGameId:
        Object.prototype.hasOwnProperty.call(patch, "activeGameId")
          ? patch.activeGameId ?? null
          : existed?.activeGameId ?? null,
      createdAt: existed?.createdAt ?? now,
      updatedAt: now,
    };

    // `rule` 是 JSON 字段，当前版本直接用 upsert 合并完整行，避免手写分支创建/更新。
    await this.ctx.database.upsert(RDICE_TABLES.channel, [next], "id");
    return (await this.getChannel(platform, channelId)) ?? next;
  }

  /** 获取频道的默认骰面，频道不存在时回退到 20。 */
  public async getChannelDefaultDice(
    platform: string,
    channelId: string,
  ): Promise<number> {
    const channel = await this.getChannel(platform, channelId);
    return channel?.rule.defaultDice ?? 20;
  }

  /** 设置频道当前激活的游戏。 */
  public async setChannelActiveGame(
    platform: string,
    channelId: string,
    gameId: number | null,
  ): Promise<RDiceChannel> {
    return this.upsertChannelConfig(platform, channelId, {
      activeGameId: gameId,
    });
  }

  /** 创建一场新的游戏或日志会话。 */
  public async createGame(input: CreateRDiceGameInput): Promise<RDiceGame> {
    const now = new Date();
    return this.ctx.database.create(RDICE_TABLES.game, {
      channelId: input.channelId,
      name: input.name,
      status: input.status ?? "active",
      gmPlatform: input.gm?.platform ?? null,
      gmUserId: input.gm?.userId ?? null,
      createdAt: now,
      updatedAt: now,
      archivedAt: input.status === "archived" ? now : null,
    });
  }

  /** 按频道与名称查找游戏。 */
  public async getGameByName(
    channelPrimaryId: string,
    name: string,
  ): Promise<RDiceGame | null> {
    const rows = await this.ctx.database.get(RDICE_TABLES.game, {
      channelId: channelPrimaryId,
      name,
    });
    return rows[0] ?? null;
  }

  /** 列出频道下未归档的全部游戏。 */
  public async listOpenGames(channelPrimaryId: string): Promise<RDiceGame[]> {
    return this.ctx.database.get(RDICE_TABLES.game, {
      channelId: channelPrimaryId,
      status: {
        $ne: "archived",
      },
    });
  }

  /** 创建角色卡。 */
  public async createCharacter(
    input: CreateRDiceCharacterInput,
  ): Promise<RDiceCharacter> {
    const now = new Date();
    return this.ctx.database.create(RDICE_TABLES.character, {
      platform: input.platform,
      userId: input.userId,
      name: input.name,
      rule: input.rule,
      data: input.data ?? {},
      createdAt: now,
      updatedAt: now,
    });
  }

  /** 列出某个用户拥有的全部角色卡。 */
  public async listCharacters(
    platform: string,
    userId: string,
  ): Promise<RDiceCharacter[]> {
    return this.ctx.database.get(RDICE_TABLES.character, { platform, userId });
  }

  /**
   * 绑定某个玩家在某场游戏中的当前角色卡。
   * 若绑定已存在，则直接覆盖到新的角色卡。
   */
  public async bindCharacterToGame(
    gameId: number,
    platform: string,
    userId: string,
    characterId: number,
  ): Promise<RDiceBinding> {
    const now = new Date();
    await this.ctx.database.upsert(
      RDICE_TABLES.binding,
      (row) => [
        {
          gameId,
          platform,
          userId,
          characterId,
          // 使用 upsert 时保留首次绑定时间，只刷新更新时间。
          createdAt: $.ifNull(row.createdAt, now),
          updatedAt: now,
        },
      ],
      ["gameId", "platform", "userId"],
    );

    const rows = await this.ctx.database.get(RDICE_TABLES.binding, {
      gameId,
      platform,
      userId,
    });
    return rows[0] as RDiceBinding;
  }

  /** 获取玩家在某场游戏中的当前角色卡。 */
  public async getBoundCharacter(
    gameId: number,
    platform: string,
    userId: string,
  ): Promise<RDiceCharacter | null> {
    // 当前查询链路只有单条绑定命中，先保持两次查询的直观实现；
    // 后续若出现批量读取需求，再评估 join/select 的收益。
    const rows = await this.ctx.database.get(RDICE_TABLES.binding, {
      gameId,
      platform,
      userId,
    });
    const binding = rows[0];
    if (!binding) return null;

    const characters = await this.ctx.database.get(
      RDICE_TABLES.character,
      binding.characterId,
    );
    return characters[0] ?? null;
  }

  /** 创建一条日志记录。 */
  public async createLog(input: CreateRDiceLogInput): Promise<RDiceLog> {
    return this.ctx.database.create(RDICE_TABLES.log, {
      gameId: input.gameId,
      type: input.type,
      message: input.message,
      payload: input.payload ?? {},
      senderName: input.senderName,
      platform: input.platform,
      userId: input.userId,
      createdAt: new Date(),
    });
  }
}
