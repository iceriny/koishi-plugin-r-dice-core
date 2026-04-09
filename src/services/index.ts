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
