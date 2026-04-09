import type { Command, Session } from "koishi";

function handleInitCommand(session: Session, rule: string) {
  if (!session)
    return "出现未知错误 session is undefined <registerInitCommand>";
  // TODO: 这里从已加载的规则插件中获取有效规则列表，暂时写死
  const validRules = ["dnd", "coc"];
  if (!rule) {
    return `请指定游戏规则。可用规则：${validRules.join(", ")}`;
  }
  if (!validRules.includes(rule)) {
    return `无效的游戏规则。可用规则：${validRules.join(", ")}`;
  }
  /*
       TODO: 这里可以添加初始化游戏规则的逻辑.
       * 1. 负责当前群的规则设置落库
       * 2. 负责相关过滤器设置
       */
}

export function registerInitCommand(mainCommand: Command) {
  mainCommand
    .subcommand(".init [rule:string]", "设置游戏规则.")
    .usage("用法：rd.init [规则]")
    .example("rd.init dnd")
    .example("rd.init coc")
    .action(async ({ session }, rule) => {
      return session ? handleInitCommand(session, rule) : undefined;
    });
}
