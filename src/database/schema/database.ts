import type { Context } from "koishi";
import type {
  RDiceBinding,
  RDiceChannel,
  RDiceCharacter,
  RDiceGame,
  RDiceLog,
} from "./index";
import { getDefaultRuleConfig, RDICE_TABLES } from "./types";

declare module "koishi" {
  interface Tables {
    rdice_channel: RDiceChannel;
    rdice_game: RDiceGame;
    rdice_character: RDiceCharacter;
    rdice_binding: RDiceBinding;
    rdice_log: RDiceLog;
  }
}

/** 向 Koishi 注册 r-dice-core 的全部数据库模型。 */
export function defineRDiceDatabaseSchema(ctx: Context) {
  ctx.model.extend(
    RDICE_TABLES.channel,
    {
      id: "string",
      platform: "string",
      channelId: "string",
      guildId: {
        type: "string",
        nullable: true,
      },
      rule: {
        type: "json",
        initial: getDefaultRuleConfig("dnd"),
      },
      logOn: {
        type: "boolean",
        initial: false,
      },
      activeGameId: {
        type: "unsigned",
        nullable: true,
      },
      createdAt: "timestamp",
      updatedAt: "timestamp",
    },
    {
      primary: "id",
      unique: [["platform", "channelId"]],
    },
  );

  ctx.model.extend(
    RDICE_TABLES.game,
    {
      id: "unsigned",
      channelId: "string",
      name: "string",
      status: {
        type: "string",
        initial: "active",
      },
      gmPlatform: {
        type: "string",
        nullable: true,
      },
      gmUserId: {
        type: "string",
        nullable: true,
      },
      createdAt: "timestamp",
      updatedAt: "timestamp",
      archivedAt: {
        type: "timestamp",
        nullable: true,
      },
    },
    {
      primary: "id",
      autoInc: true,
      indexes: [["channelId", "status"], ["channelId", "name"]],
      foreign: {
        channelId: [RDICE_TABLES.channel, "id"],
      },
    },
  );

  ctx.model.extend(
    RDICE_TABLES.character,
    {
      id: "unsigned",
      platform: "string",
      userId: "string",
      name: "string",
      rule: {
        type: "json",
        initial: {
          rule: "dnd",
          version: "5e",
        },
      },
      data: {
        type: "json",
        initial: {},
      },
      createdAt: "timestamp",
      updatedAt: "timestamp",
    },
    {
      primary: "id",
      autoInc: true,
    },
  );

  ctx.model.extend(
    RDICE_TABLES.binding,
    {
      id: "unsigned",
      gameId: "unsigned",
      platform: "string",
      userId: "string",
      characterId: "unsigned",
      createdAt: "timestamp",
      updatedAt: "timestamp",
    },
    {
      primary: "id",
      autoInc: true,
      unique: [["gameId", "platform", "userId"]],
      foreign: {
        gameId: [RDICE_TABLES.game, "id"],
        characterId: [RDICE_TABLES.character, "id"],
      },
    },
  );

  ctx.model.extend(
    RDICE_TABLES.log,
    {
      id: "unsigned",
      gameId: "unsigned",
      type: "string",
      message: "text",
      payload: {
        type: "json",
        initial: {},
      },
      senderName: "string",
      platform: "string",
      userId: "string",
      createdAt: "timestamp",
    },
    {
      primary: "id",
      autoInc: true,
      indexes: [["gameId", "createdAt"]],
      foreign: {
        gameId: [RDICE_TABLES.game, "id"],
      },
    },
  );
}
