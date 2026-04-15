import type { Observed } from "@koishijs/utils";
import { observe } from "@koishijs/utils";
import { type Context, Service, type Session } from "koishi";
import type {
  RDiceBinding,
  RDiceChannel,
  RDiceCharacter,
  RDiceGame,
  RDiceLog,
  RDiceLogPayload,
  RDiceLogType,
} from "../database";
import type RDiceDatabaseService from "./database";

type RDiceFieldKey<T extends object> = Extract<keyof T, string>;
type RDiceChannelMetaField =
  | "id"
  | "platform"
  | "channelId"
  | "logOn"
  | "activeGameId";
type RDiceObserverState = "inactive" | "direct_db" | "observer";
type RDiceObservedEntity<T extends object> = Observed<T, Promise<void> | void>;

export interface CreateLogDraftInput {
  gameId: number;
  type?: RDiceLogType;
  message?: string;
  payload?: RDiceLogPayload;
  senderName?: string;
}

export interface SessionObserverScope {
  state: RDiceObserverState;
  channelMeta: Pick<RDiceChannel, RDiceChannelMetaField> | null;
  channel?: RDiceObservedEntity<RDiceChannel>;
  activeGame?: RDiceObservedEntity<RDiceGame> | null;
  bindings: Map<string, RDiceObservedEntity<RDiceBinding>>;
  characters: Map<number, RDiceObservedEntity<RDiceCharacter>>;
  logDrafts: Set<RDiceObservedEntity<RDiceLog>>;
  loadedFields: {
    channel: Set<string>;
    activeGame: Set<string>;
    bindings: Map<string, Set<string>>;
    characters: Map<number, Set<string>>;
  };
}

/**
 * r-dice-core 自定义观察者服务。
 * 仅在频道已开启日志时为当前 Session 建立业务观察者上下文。
 */
export default class RDiceObserverService extends Service {
  private readonly sessionScopes = new WeakMap<Session, SessionObserverScope>();

  constructor(
    ctx: Context,
    private readonly rdiceDbService: RDiceDatabaseService,
  ) {
    super(ctx, "rdiceObserver");
  }

  /** 获取绑定观察者的缓存键。 */
  private createBindingKey(
    gameId: number,
    platform: string,
    userId: string,
  ): string {
    return `${gameId}:${platform}:${userId}`;
  }

  /** 创建一个新的会话观察者作用域。 */
  private createScope(
    state: RDiceObserverState,
    channelMeta: Pick<RDiceChannel, RDiceChannelMetaField> | null,
  ): SessionObserverScope {
    return {
      state,
      channelMeta,
      activeGame: undefined,
      bindings: new Map(),
      characters: new Map(),
      logDrafts: new Set(),
      loadedFields: {
        channel: new Set(),
        activeGame: new Set(),
        bindings: new Map(),
        characters: new Map(),
      },
    };
  }

  /** 计算仍需补读的字段集合。 */
  private collectMissingFields(
    loadedFields: Set<string>,
    requiredFields: readonly string[],
    requestedFields: readonly string[],
  ): string[] {
    const targetFields = new Set([...requiredFields, ...requestedFields]);
    return [...targetFields].filter((field) => !loadedFields.has(field));
  }

  /** 记录某类实体已加载的字段。 */
  private rememberFields(
    loadedFields: Set<string>,
    fields: readonly string[],
  ) {
    fields.forEach((field) => loadedFields.add(field));
  }

  /** 仅在存在 diff 时执行一次 `$update()`。 */
  private async flushObserved<T extends object>(
    target?: RDiceObservedEntity<T> | null,
  ) {
    if (!target || !Object.keys(target.$diff).length) return;
    await target.$update();
  }

  /**
   * 获取当前会话的业务观察者作用域。
   * 未初始化频道返回 `inactive`，未开启日志返回 `direct_db`。
   */
  public async getScope(session: Session): Promise<SessionObserverScope> {
    const cached = this.sessionScopes.get(session);
    if (cached) return cached;

    if (!session.platform || !session.channelId) {
      const scope = this.createScope("inactive", null);
      this.sessionScopes.set(session, scope);
      return scope;
    }

    const channelMeta = await this.rdiceDbService.getChannelFields(
      session.platform,
      session.channelId,
      ["id", "platform", "channelId", "logOn", "activeGameId"],
    );

    const scope = !channelMeta
      ? this.createScope("inactive", null)
      : channelMeta.logOn
        ? this.createScope("observer", channelMeta)
        : this.createScope("direct_db", channelMeta);
    this.sessionScopes.set(session, scope);
    return scope;
  }

  /** 当前会话是否进入观察者模式。 */
  public async shouldUseObserver(session: Session): Promise<boolean> {
    const scope = await this.getScope(session);
    return scope.state === "observer";
  }

  /** 清理当前会话的缓存作用域。 */
  public clearScope(session: Session) {
    this.sessionScopes.delete(session);
  }

  /** 观察频道实体。 */
  public async observeChannel<K extends RDiceFieldKey<RDiceChannel>>(
    session: Session,
    fields: readonly K[] = [],
  ): Promise<RDiceObservedEntity<RDiceChannel> | null> {
    const scope = await this.getScope(session);
    if (scope.state !== "observer" || !session.platform || !session.channelId) {
      return null;
    }

    const missingFields = this.collectMissingFields(
      scope.loadedFields.channel,
      ["id", "platform", "channelId", "logOn", "activeGameId"],
      fields,
    ) as K[];

    if (scope.channel) {
      if (missingFields.length) {
        const patch = await this.rdiceDbService.getChannelFields(
          session.platform,
          session.channelId,
          missingFields,
        );
        if (patch) {
          scope.channel.$merge(patch as Partial<RDiceChannel>);
          this.rememberFields(scope.loadedFields.channel, missingFields);
        }
      }
      return scope.channel;
    }

    const channel = (await this.rdiceDbService.getChannelFields(
      session.platform,
      session.channelId,
      missingFields,
    )) as (Pick<RDiceChannel, K> & Pick<RDiceChannel, "id">) | null;
    if (!channel) return null;

    const observed = observe(
      channel as RDiceChannel,
      async (diff) => {
        await this.rdiceDbService.patchChannelById(channel.id, diff);
      },
      `rdice-channel ${channel.id}`,
    );
    scope.channel = observed;
    this.rememberFields(scope.loadedFields.channel, missingFields);
    return observed;
  }

  /** 观察当前频道的激活游戏。 */
  public async observeActiveGame<K extends RDiceFieldKey<RDiceGame>>(
    session: Session,
    fields: readonly K[] = [],
  ): Promise<RDiceObservedEntity<RDiceGame> | null> {
    const scope = await this.getScope(session);
    if (scope.state !== "observer") return null;

    const channel = await this.observeChannel(session, ["activeGameId"]);
    if (!channel?.activeGameId) {
      scope.activeGame = null;
      return null;
    }

    if (scope.activeGame && scope.activeGame.id !== channel.activeGameId) {
      scope.activeGame = undefined;
      scope.loadedFields.activeGame.clear();
    }

    const missingFields = this.collectMissingFields(
      scope.loadedFields.activeGame,
      ["id", "channelId"],
      fields,
    ) as K[];

    if (scope.activeGame) {
      if (missingFields.length) {
        const patch = await this.rdiceDbService.getGameFields(
          channel.activeGameId,
          missingFields,
        );
        if (patch) {
          scope.activeGame.$merge(patch as Partial<RDiceGame>);
          this.rememberFields(scope.loadedFields.activeGame, missingFields);
        }
      }
      return scope.activeGame;
    }

    const game = (await this.rdiceDbService.getGameFields(
      channel.activeGameId,
      missingFields,
    )) as (Pick<RDiceGame, K> & Pick<RDiceGame, "id">) | null;
    if (!game) return null;

    const observed = observe(
      game as RDiceGame,
      async (diff) => {
        await this.rdiceDbService.patchGameById(game.id, diff);
      },
      `rdice-game ${game.id}`,
    );
    scope.activeGame = observed;
    this.rememberFields(scope.loadedFields.activeGame, missingFields);
    return observed;
  }

  /** 观察某个玩家在游戏中的绑定。 */
  public async observeBinding<K extends RDiceFieldKey<RDiceBinding>>(
    session: Session,
    gameId: number,
    userId = session.userId,
    fields: readonly K[] = [],
  ): Promise<RDiceObservedEntity<RDiceBinding> | null> {
    const scope = await this.getScope(session);
    if (scope.state !== "observer" || !session.platform || !userId) {
      return null;
    }

    const bindingKey = this.createBindingKey(gameId, session.platform, userId);
    const loadedFields =
      scope.loadedFields.bindings.get(bindingKey) ?? new Set<string>();
    scope.loadedFields.bindings.set(bindingKey, loadedFields);

    const missingFields = this.collectMissingFields(
      loadedFields,
      ["id", "gameId", "platform", "userId", "characterId"],
      fields,
    ) as K[];

    const cached = scope.bindings.get(bindingKey);
    if (cached) {
      if (missingFields.length) {
        const patch = await this.rdiceDbService.getBindingFields(
          gameId,
          session.platform,
          userId,
          missingFields,
        );
        if (patch) {
          cached.$merge(patch as Partial<RDiceBinding>);
          this.rememberFields(loadedFields, missingFields);
        }
      }
      return cached;
    }

    const binding = (await this.rdiceDbService.getBindingFields(
      gameId,
      session.platform,
      userId,
      missingFields,
    )) as (Pick<RDiceBinding, K> & Pick<RDiceBinding, "id">) | null;
    if (!binding) return null;

    const observed = observe(
      binding as RDiceBinding,
      async (diff) => {
        await this.rdiceDbService.patchBindingById(binding.id, diff);
      },
      `rdice-binding ${bindingKey}`,
    );
    scope.bindings.set(bindingKey, observed);
    this.rememberFields(loadedFields, missingFields);
    return observed;
  }

  /** 观察角色卡实体。 */
  public async observeCharacter<K extends RDiceFieldKey<RDiceCharacter>>(
    session: Session,
    characterId: number,
    fields: readonly K[] = [],
  ): Promise<RDiceObservedEntity<RDiceCharacter> | null> {
    const scope = await this.getScope(session);
    if (scope.state !== "observer") return null;

    const loadedFields =
      scope.loadedFields.characters.get(characterId) ?? new Set<string>();
    scope.loadedFields.characters.set(characterId, loadedFields);

    const missingFields = this.collectMissingFields(
      loadedFields,
      ["id"],
      fields,
    ) as K[];

    const cached = scope.characters.get(characterId);
    if (cached) {
      if (missingFields.length) {
        const patch = await this.rdiceDbService.getCharacterFields(
          characterId,
          missingFields,
        );
        if (patch) {
          cached.$merge(patch as Partial<RDiceCharacter>);
          this.rememberFields(loadedFields, missingFields);
        }
      }
      return cached;
    }

    const character = (await this.rdiceDbService.getCharacterFields(
      characterId,
      missingFields,
    )) as (Pick<RDiceCharacter, K> & Pick<RDiceCharacter, "id">) | null;
    if (!character) return null;

    const observed = observe(
      character as RDiceCharacter,
      async (diff) => {
        await this.rdiceDbService.patchCharacterById(character.id, diff);
      },
      `rdice-character ${characterId}`,
    );
    scope.characters.set(characterId, observed);
    this.rememberFields(loadedFields, missingFields);
    return observed;
  }

  /**
   * 创建一条待提交的日志草稿观察者。
   * 首轮实现只在 `$update()` 时创建一次日志行，不支持后续增量回写。
   */
  public async observeLogDraft(
    session: Session,
    input: CreateLogDraftInput,
  ): Promise<RDiceObservedEntity<RDiceLog> | null> {
    const scope = await this.getScope(session);
    if (scope.state !== "observer" || !session.platform || !session.userId) {
      return null;
    }

    let created = false;
    const draft: RDiceLog = {
      id: 0,
      gameId: input.gameId,
      type: input.type ?? "ooc",
      message: input.message ?? "",
      payload: input.payload ?? {},
      senderName: input.senderName ?? session.username ?? "",
      platform: session.platform,
      userId: session.userId,
      createdAt: new Date(),
    };

    const observed = observe(
      draft,
      async () => {
        if (created || !draft.gameId || !draft.message) return;
        const row = await this.rdiceDbService.createLog({
          gameId: draft.gameId,
          type: draft.type,
          message: draft.message,
          payload: draft.payload,
          senderName: draft.senderName,
          platform: draft.platform,
          userId: draft.userId,
        });
        created = true;
        draft.id = row.id;
        draft.createdAt = row.createdAt;
      },
      `rdice-log-draft ${session.platform}:${session.userId}:${input.gameId}`,
    );
    scope.logDrafts.add(observed);
    return observed;
  }

  /** 在会话结束时统一提交本轮业务观察者。 */
  public async flushSession(session: Session) {
    const scope = this.sessionScopes.get(session);
    if (!scope) return;

    try {
      if (scope.state !== "observer") return;

      await this.flushObserved(scope.channel);
      await this.flushObserved(scope.activeGame);
      for (const binding of scope.bindings.values()) {
        await this.flushObserved(binding);
      }
      for (const character of scope.characters.values()) {
        await this.flushObserved(character);
      }
      for (const logDraft of scope.logDrafts) {
        await this.flushObserved(logDraft);
      }
    } finally {
      this.sessionScopes.delete(session);
    }
  }
}
