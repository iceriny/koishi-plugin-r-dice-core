import { Context } from "koishi";
import DiceGroup, { DICE_SIDES } from "../../dice";
import type RDiceDatabaseService from "../../services/database";

/** 注册掷骰命令。 */
export function registerRollCommand(
  ctx: Context,
  rdiceDbService: RDiceDatabaseService,
) {
  const diceSideSet = new Set<number>(DICE_SIDES);

  ctx
    .command("r <expression:text>", "掷骰子")
    .alias("roll")
    .usage(
      "- 掷骰子表达式，支持常量、骰子、运算符和括号\n- 裸数字默认表示常量，例如 `d20 + 4`\n- 如果要投掷骰子，必须显式使用 `d20`、`2d6` 这类写法\n- 当整条输入是单个受支持面数时，例如 `20`，命令会将其视为 `d20` 的快捷写法",
    )
    .example("'r 20' 作为快捷写法掷一次20面骰")
    .example("'r d20' 显式掷一次20面骰")
    .example("'r 2d6 + 4' 掷两次6面骰，然后加上常量4")
    .example(
      "'r (d20 + 4) * d6' 掷一次20面骰，然后加上常量4，再乘以6面骰的掷点",
    )
    .action(async ({ session }, expression) => {
      try {
        // 优先读取频道默认骰面，缺失时再回退到 d20。
        const defaultDiceSides =
          session?.platform && session.channelId
            ? await rdiceDbService.getChannelDefaultDice(
                session.platform,
                session.channelId,
              )
            : 20;
        const normalizedExpression = expression
          ? expression.trim()
          : `${defaultDiceSides}`;
        const commandExpression =
          /^\d+$/.test(normalizedExpression) &&
          diceSideSet.has(Number(normalizedExpression))
            ? `d${normalizedExpression}`
            : normalizedExpression;
        const result = new DiceGroup(commandExpression).rollDetailed();

        if (result.rolls.length === 0) {
          return `计算结果为 ${result.total}`;
        }

        return `掷出了 ${result.total}，结果为：${result.rolls.map((item) => `d${item.sides}=> ${item.value}`).join("，")}`;
      } catch (error) {
        return `掷骰子失败：${(error as Error).message}`;
      }
    });
}
