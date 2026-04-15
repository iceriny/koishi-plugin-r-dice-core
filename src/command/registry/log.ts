import { h, type Context, type Session } from "koishi";
import type { Command } from "koishi";
import type { RDiceGame, RDiceLog } from "../../database";
import type RDiceDatabaseService from "../../services/database";

function normalizeLogName(name: string | undefined): string {
  return name?.trim() ?? "";
}

async function ensureChannelReady(
  session: Session,
  rdiceDbService: RDiceDatabaseService,
) {
  if (!session.platform || !session.channelId) {
    return {
      ok: false as const,
      message: "无法获取当前频道信息，无法操作日志。",
    };
  }

  const channel = await rdiceDbService.getChannel(session.platform, session.channelId);
  if (!channel) {
    return {
      ok: false as const,
      message: "当前频道尚未初始化，请先使用 rd.init [规则]。",
    };
  }

  return {
    ok: true as const,
    channel,
    channelPrimaryId: rdiceDbService.createChannelPrimaryId(
      session.platform,
      session.channelId,
    ),
  };
}

async function activateGame(
  session: Session,
  rdiceDbService: RDiceDatabaseService,
  game: RDiceGame,
) {
  const now = new Date();
  await rdiceDbService.patchGameById(game.id, {
    status: "active",
    archivedAt: null,
    updatedAt: now,
  });
  await rdiceDbService.upsertChannelConfig(session.platform!, session.channelId!, {
    logOn: true,
    activeGameId: game.id,
  });
}

async function archiveGame(
  session: Session,
  rdiceDbService: RDiceDatabaseService,
  game: RDiceGame,
  deactivateChannel: boolean,
) {
  const now = new Date();
  await rdiceDbService.patchGameById(game.id, {
    status: "archived",
    archivedAt: now,
    updatedAt: now,
  });
  if (!deactivateChannel) {
    return;
  }
  await rdiceDbService.upsertChannelConfig(session.platform!, session.channelId!, {
    logOn: false,
    activeGameId: null,
  });
}

function formatLogType(type: RDiceLog["type"]): string {
  if (type === "rp") return "RP";
  if (type === "action") return "ACTION";
  return "OOC";
}

function buildLogFileName(game: RDiceGame): string {
  const normalizedName = game.name.replace(/[\\/:*?"<>|]/g, "_").trim() || `game-${game.id}`;
  return `${normalizedName}.txt`;
}

function renderLogFileContent(game: RDiceGame, logs: RDiceLog[]): string {
  const lines = [
    `# ${game.name}`,
    `游戏ID: ${game.id}`,
    `状态: ${game.status}`,
    `创建时间: ${game.createdAt.toLocaleString()}`,
    `归档时间: ${game.archivedAt ? game.archivedAt.toLocaleString() : "未归档"}`,
    "",
  ];

  if (!logs.length) {
    lines.push("（暂无日志内容）");
    return `${lines.join("\n")}\n`;
  }

  for (const log of logs) {
    lines.push(
      `[${log.createdAt.toLocaleString()}] [${formatLogType(log.type)}] ${log.senderName}(${log.platform}:${log.userId})`,
    );
    lines.push(log.message);
    if (Object.keys(log.payload ?? {}).length) {
      lines.push(`payload: ${JSON.stringify(log.payload)}`);
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

async function sendGameLogFile(
  session: Session,
  rdiceDbService: RDiceDatabaseService,
  game: RDiceGame,
) {
  const logs = await rdiceDbService.listLogsByGame(game.id);
  const content = renderLogFileContent(game, logs);
  const filename = buildLogFileName(game);
  await session.send(
    h.file(Buffer.from(content, "utf8"), "text/plain", {
      title: filename,
    }),
  );
  return logs.length;
}

async function handleLogOn(
  session: Session,
  rdiceDbService: RDiceDatabaseService,
  name?: string,
) {
  const ready = await ensureChannelReady(session, rdiceDbService);
  if (!ready.ok) return ready.message;

  const logName = normalizeLogName(name);
  const { channel, channelPrimaryId } = ready;

  if (logName) {
    const existed = await rdiceDbService.getGameByName(channelPrimaryId, logName);
    if (existed) {
      await activateGame(session, rdiceDbService, existed);
      return `已开启日志《${existed.name}》。`;
    }

    const game = await rdiceDbService.createGame({
      channelId: channelPrimaryId,
      name: logName,
      status: "active",
      gm: session.userId
        ? {
            platform: session.platform!,
            userId: session.userId,
          }
        : null,
    });
    await rdiceDbService.upsertChannelConfig(session.platform!, session.channelId!, {
      logOn: true,
      activeGameId: game.id,
    });
    return `已新建并开启日志《${game.name}》。`;
  }

  let targetGame: RDiceGame | null = null;
  if (channel.activeGameId) {
    const currentGame = await rdiceDbService.getGameById(channel.activeGameId);
    if (currentGame && currentGame.status !== "archived") {
      targetGame = currentGame;
    }
  }

  if (!targetGame) {
    const openGames = await rdiceDbService.listOpenGames(channelPrimaryId);
    targetGame = openGames[0] ?? null;
  }

  if (!targetGame) {
    return "当前没有可开启的日志，请先使用 .log.on [日志名] 创建日志。";
  }

  await activateGame(session, rdiceDbService, targetGame);
  return `已开启最近的日志《${targetGame.name}》。`;
}

async function handleLogOff(
  session: Session,
  rdiceDbService: RDiceDatabaseService,
) {
  const ready = await ensureChannelReady(session, rdiceDbService);
  if (!ready.ok) return ready.message;

  const { channel } = ready;
  if (!channel.logOn || !channel.activeGameId) {
    return "当前没有正在记录的日志。";
  }

  const currentGame = await rdiceDbService.getGameById(channel.activeGameId);
  if (!currentGame) {
    await rdiceDbService.upsertChannelConfig(session.platform!, session.channelId!, {
      logOn: false,
      activeGameId: null,
    });
    return "当前日志记录状态已重置，但没有找到对应的日志实体。";
  }

  await rdiceDbService.patchGameById(currentGame.id, {
    status: "paused",
    updatedAt: new Date(),
  });
  await rdiceDbService.upsertChannelConfig(session.platform!, session.channelId!, {
    logOn: false,
  });
  return `已关闭日志《${currentGame.name}》的记录。`;
}

async function handleLogEnd(
  session: Session,
  rdiceDbService: RDiceDatabaseService,
  name?: string,
) {
  const ready = await ensureChannelReady(session, rdiceDbService);
  if (!ready.ok) return ready.message;

  const logName = normalizeLogName(name);
  const { channel, channelPrimaryId } = ready;

  let targetGame: RDiceGame | null = null;
  if (logName) {
    targetGame = await rdiceDbService.getGameByName(channelPrimaryId, logName);
    if (!targetGame) {
      return `没有找到名为《${logName}》的日志。`;
    }

    if (targetGame.status === "archived") {
      const logCount = await sendGameLogFile(session, rdiceDbService, targetGame);
      return `日志《${targetGame.name}》已经归档，已重新发送日志文件（共 ${logCount} 条记录）。`;
    }
  } else if (channel.logOn && channel.activeGameId) {
    targetGame = await rdiceDbService.getGameById(channel.activeGameId);
    if (!targetGame) {
      await rdiceDbService.upsertChannelConfig(session.platform!, session.channelId!, {
        logOn: false,
        activeGameId: null,
      });
      return "当前日志记录状态已重置，但没有找到对应的日志实体。";
    }
  } else {
    const openGames = await rdiceDbService.listOpenGames(channelPrimaryId);
    targetGame = openGames[0] ?? null;
    if (!targetGame) {
      return "当前没有正在记录或未归档的日志。";
    }

    await session.send(
      `当前没有正在记录的日志。最近未归档日志为《${targetGame.name}》。请在 30 秒内回复“确认”以结束它。`,
    );
    const confirm = await session.prompt(30000);
    if (!confirm) {
      return "等待确认超时，这次先不结束日志。";
    }
    if (confirm.trim() !== "确认") {
      return "已取消结束日志。";
    }
  }

  await archiveGame(
    session,
    rdiceDbService,
    targetGame,
    channel.activeGameId === targetGame.id,
  );
  const logCount = await sendGameLogFile(session, rdiceDbService, targetGame);
  return `日志《${targetGame.name}》已结束并归档，已发送日志文件（共 ${logCount} 条记录）。`;
}

/** 注册日志命令。 */
export function registerLogCommand(
  ctx: Context,
  rdiceDbService: RDiceDatabaseService,
) {
  const mainCommand = ctx.command("log", "日志记录");

  mainCommand
    .subcommand(".on [name:text]", "开启日志记录")
    .usage("用法：log.on [日志名]")
    .example("log.on coc-第一团")
    .action(async ({ session }, name) => {
      return session ? handleLogOn(session, rdiceDbService, name) : undefined;
    });

  mainCommand
    .subcommand(".off", "关闭当前日志记录")
    .usage("用法：log.off")
    .action(async ({ session }) => {
      return session ? handleLogOff(session, rdiceDbService) : undefined;
    });

  mainCommand
    .subcommand(".end [name:text]", "结束并归档日志")
    .usage("用法：log.end [日志名]")
    .example("log.end coc-第一团")
    .action(async ({ session }, name) => {
      return session ? handleLogEnd(session, rdiceDbService, name) : undefined;
    });
}
