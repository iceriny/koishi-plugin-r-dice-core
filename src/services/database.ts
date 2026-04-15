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

type RDiceFieldKey<T extends object> = Extract<keyof T, string>;

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

  /**
   * 读取单行数据，并按需裁剪字段。
   * @param table 表名
   * @param query 查询条件
   * @param fields 需要的字段列表
   * @returns 第一条匹配记录，不存在时返回 `null`
   */
  private async getSingleRow<T extends object, K extends RDiceFieldKey<T>>(
    table: string,
    query: unknown,
    fields: readonly K[],
  ): Promise<Pick<T, K> | null> {
    const rows = await this.ctx.database.get(
      table as never,
      query as never,
      {
        fields: [...fields] as never,
      },
    );
    return (rows[0] ?? null) as unknown as Pick<T, K> | null;
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

  /** 按字段读取频道数据。 */
  public async getChannelFields<K extends RDiceFieldKey<RDiceChannel>>(
    platform: string,
    channelId: string,
    fields: readonly K[],
  ): Promise<Pick<RDiceChannel, K> | null> {
    return this.getSingleRow<RDiceChannel, K>(
      RDICE_TABLES.channel,
      createChannelPrimaryId(platform, channelId),
      fields,
    );
  }

  /** 按主键更新频道。 */
  public async patchChannelById(
    id: string,
    patch: Partial<RDiceChannel>,
  ) {
    return this.ctx.database.set(RDICE_TABLES.channel, id, patch);
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
    const channel = await this.getChannelFields(platform, channelId, ["rule"]);
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

  /** 按主键读取游戏。 */
  public async getGameById(id: number): Promise<RDiceGame | null> {
    const rows = await this.ctx.database.get(RDICE_TABLES.game, id);
    return rows[0] ?? null;
  }

  /** 按字段读取游戏。 */
  public async getGameFields<K extends RDiceFieldKey<RDiceGame>>(
    id: number,
    fields: readonly K[],
  ): Promise<Pick<RDiceGame, K> | null> {
    return this.getSingleRow<RDiceGame, K>(RDICE_TABLES.game, id, fields);
  }

  /** 读取频道当前激活游戏的指定字段。 */
  public async getActiveGameFields<K extends RDiceFieldKey<RDiceGame>>(
    channelPrimaryId: string,
    fields: readonly K[],
  ): Promise<Pick<RDiceGame, K> | null> {
    const channel = await this.getSingleRow<RDiceChannel, "activeGameId">(
      RDICE_TABLES.channel,
      channelPrimaryId,
      ["activeGameId"],
    );
    if (!channel?.activeGameId) return null;
    return this.getGameFields(channel.activeGameId, fields);
  }

  /** 按主键更新游戏。 */
  public async patchGameById(
    id: number,
    patch: Partial<RDiceGame>,
  ) {
    return this.ctx.database.set(RDICE_TABLES.game, id, patch);
  }

  /** 按频道与名称查找游戏。 */
  public async getGameByName(
    channelPrimaryId: string,
    name: string,
  ): Promise<RDiceGame | null> {
    const rows = await this.ctx.database.get(RDICE_TABLES.game, {
      channelId: channelPrimaryId,
      name,
    }, {
      limit: 1,
      sort: {
        updatedAt: "desc",
      },
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
    }, {
      sort: {
        updatedAt: "desc",
      },
    });
  }

  /** 按游戏读取全部日志，按时间正序返回。 */
  public async listLogsByGame(gameId: number): Promise<RDiceLog[]> {
    return this.ctx.database.get(RDICE_TABLES.log, {
      gameId,
    }, {
      sort: {
        createdAt: "asc",
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

  /** 按主键读取角色卡。 */
  public async getCharacterById(id: number): Promise<RDiceCharacter | null> {
    const rows = await this.ctx.database.get(RDICE_TABLES.character, id);
    return rows[0] ?? null;
  }

  /** 按字段读取角色卡。 */
  public async getCharacterFields<K extends RDiceFieldKey<RDiceCharacter>>(
    id: number,
    fields: readonly K[],
  ): Promise<Pick<RDiceCharacter, K> | null> {
    return this.getSingleRow<RDiceCharacter, K>(
      RDICE_TABLES.character,
      id,
      fields,
    );
  }

  /** 按主键更新角色卡。 */
  public async patchCharacterById(
    id: number,
    patch: Partial<RDiceCharacter>,
  ) {
    return this.ctx.database.set(RDICE_TABLES.character, id, patch);
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

  /** 读取玩家在某场游戏中的绑定。 */
  public async getBinding(
    gameId: number,
    platform: string,
    userId: string,
  ): Promise<RDiceBinding | null> {
    const rows = await this.ctx.database.get(RDICE_TABLES.binding, {
      gameId,
      platform,
      userId,
    });
    return rows[0] ?? null;
  }

  /** 按字段读取玩家在某场游戏中的绑定。 */
  public async getBindingFields<K extends RDiceFieldKey<RDiceBinding>>(
    gameId: number,
    platform: string,
    userId: string,
    fields: readonly K[],
  ): Promise<Pick<RDiceBinding, K> | null> {
    return this.getSingleRow<RDiceBinding, K>(
      RDICE_TABLES.binding,
      { gameId, platform, userId },
      fields,
    );
  }

  /** 按主键更新绑定。 */
  public async patchBindingById(
    id: number,
    patch: Partial<RDiceBinding>,
  ) {
    return this.ctx.database.set(RDICE_TABLES.binding, id, patch);
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
