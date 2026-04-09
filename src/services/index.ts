import { type Context, Service } from "koishi";
import DiceGroup, { DICE_SIDES } from "../dice";

export default class DiceService extends Service {
  constructor(ctx: Context) {
    super(ctx, "dice");
  }

  /**
   * 解析表达式
   * @param expression 表达式
   * @returns 解析后的表达式树
   */
  public parse(expression: string) {
    return DiceGroup.parse(expression);
  }

  /**
   * 掷骰子，并返回详细结果
   * @param expression 表达式
   * @returns 掷骰子结果
   */
  public rollDetailed(expression: string) {
    const diceGroup = new DiceGroup(expression);
    const result = diceGroup.rollDetailed();
    return result;
  }

  /**
   * 掷骰子，并返回总结果
   * @param expression 表达式
   * @returns 掷骰子结果
   */
  public roll(expression: string) {
    const diceGroup = new DiceGroup(expression);
    const result = diceGroup.roll();
    return result;
  }
}

// export namespace DiceServiceUtils {
//   export function addCommands(ctx: Context, config: Config) {
//     if (config.addedCommands) {
//       const diceSideSet = new Set<number>(DICE_SIDES);

//       ctx
//         .command("rd <expression:text>", "掷骰子")
//         .usage(
//           "- 掷骰子表达式，支持常量、骰子、运算符和括号\n- 裸数字默认表示常量，例如 `d20 + 4`\n- 如果要投掷骰子，必须显式使用 `d20`、`2d6` 这类写法\n- 当整条输入是单个受支持面数时，例如 `20`，命令会将其视为 `d20` 的快捷写法",
//         )
//         .example("'rd 20' 作为快捷写法掷一次20面骰")
//         .example("'rd d20' 显式掷一次20面骰")
//         .example("'rd 2d6 + 4' 掷两次6面骰，然后加上常量4")
//         .example(
//           "'rd (d20 + 4) * d6' 掷一次20面骰，然后加上常量4，再乘以6面骰的掷点",
//         )
//         .action(async (_, expression) => {
//           try {
//             const normalizedExpression = expression.trim();
//             const commandExpression =
//               /^\d+$/.test(normalizedExpression) &&
//               diceSideSet.has(Number(normalizedExpression))
//                 ? `d${normalizedExpression}`
//                 : expression;
//             const result = new DiceGroup(commandExpression).rollDetailed();

//             if (result.rolls.length === 0) {
//               return `计算结果为 ${result.total}`;
//             }

//             return `掷出了 ${result.total}，结果为：${result.rolls.map((item) => `d${item.sides}=> ${item.value}`).join("，")}`;
//           } catch (error) {
//             return `掷骰子失败：${(error as Error).message}`;
//           }
//         });
//     }
//   }
// }
