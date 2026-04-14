import { randomInt } from "../utils/random";

/** 当前实现允许解析的骰子面数集合。 */
export const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const;

/** 支持的骰子面数。 */
export type DiceSide = typeof DICE_SIDES[number];


/** 单颗骰子的配置。 */
export interface DiceOptions {
  /** 骰子面数。 */
  sides: DiceSide;
}

/** 表示一颗可投掷的骰子。 */
export class Dice {
  /** 当前骰子的面数。 */
  private sides: DiceSide;

  /**
   * 创建一颗指定面数的骰子。
   * @param sides 骰子面数
   */
  constructor(sides: DiceSide) {
    this.sides = sides;
  }

  /**
   * 获取骰子面数。
   * @returns 当前骰子的面数
   */
  getSides(): DiceSide {
    return this.sides;
  }

  /**
   * 连续投掷多次。
   * @param count 投掷次数
   * @returns 每次投掷的结果列表
   */
  roll(count: number): number[];
  /**
   * 投掷一次。
   * @returns 单次投掷结果
   */
  roll(): number;
  roll(count?: number): number[] | number {
    if (count !== undefined) {
      return Array.from({ length: count }, () => randomInt(1, this.sides));
    }
    return randomInt(1, this.sides);
  }
}

/** 支持的二元运算符。 */
export type DiceOperator = "+" | "-" | "*";

/**
 * 骰子表达式树。
 *
 * `dice` 节点表示一次或多次同面数骰子的投掷，
 * `constant` 节点表示一个固定数值，
 * `binary` 节点表示两个子表达式之间的算术运算。
 */
export type DiceExpression =
  | {
      /** 表示骰子投掷节点。 */
      type: "dice";
      /** 该骰子需要投掷的次数。 */
      count: number;
      /** 该骰子的面数。 */
      sides: DiceSide;
    }
  | {
      /** 表示常量数字节点。 */
      type: "constant";
      /** 当前节点表示的固定数值。 */
      value: number;
    }
  | {
      /** 表示二元运算节点。 */
      type: "binary";
      /** 当前节点对应的运算符。 */
      operator: DiceOperator;
      /** 左侧子表达式。 */
      left: DiceExpression;
      /** 右侧子表达式。 */
      right: DiceExpression;
    };

/** 单颗骰子的一次实际投掷结果。 */
export interface DiceRollDetail {
  /** 被投掷骰子的面数。 */
  sides: DiceSide;
  /** 本次投掷出的点数。 */
  value: number;
}

/** 一次完整表达式求值后的结果。 */
export interface DiceGroupRollResult {
  /** 表达式最终计算出的总值。 */
  total: number;
  /** 本次求值过程中所有骰子的投掷明细。 */
  rolls: DiceRollDetail[];
}

/**
 * 词法分析阶段使用的 token。
 *
 * 用于把原始表达式拆分为骰子、常量、运算符和括号，
 * 以便后续基于栈完成优先级解析。
 */
type Token =
  | {
      /** 表示一个骰子 token。 */
      type: "dice";
      /** 该骰子 token 对应的投掷次数。 */
      count: number;
      /** 该骰子 token 对应的骰子面数。 */
      sides: DiceSide;
    }
  | {
      /** 表示一个常量 token。 */
      type: "constant";
      /** 当前 token 携带的固定数值。 */
      value: number;
    }
  | {
      /** 表示一个运算符 token。 */
      type: "operator";
      /** 当前 token 携带的运算符。 */
      value: DiceOperator;
    }
  | {
      /** 表示左括号 token。 */
      type: "leftParen";
    }
  | {
      /** 表示右括号 token。 */
      type: "rightParen";
    };

/** 各运算符的优先级定义，数值越大优先级越高。 */
const OPERATOR_PRIORITY: Record<DiceOperator, number> = {
  "+": 1,
  "-": 1,
  "*": 2,
};

/**
 * 判断一个数字是否为受支持的骰子面数。
 * @param value 待检查的数字
 * @returns 是否为合法的 `DiceSide`
 */
function isDiceSide(value: number): value is DiceSide {
  return DICE_SIDES.includes(value as DiceSide);
}

/**
 * 将普通数字收窄为 `DiceSide`。
 * @param value 待转换的面数
 * @returns 合法的骰子面数
 * @throws 当面数不是正整数或不在支持范围内时抛出异常
 */
function toDiceSide(value: number): DiceSide {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`骰子面数不是整数或小于等于0：${value}, 只允许: ${DICE_SIDES.join(", ")}`);
  }
  if (!isDiceSide(value)) {
    throw new Error(`不支持的骰子面数：${value}, 只允许: ${DICE_SIDES.join(", ")}`);
  }
  return value;
}

/**
 * 表示一个可解析、可投掷、可求值的骰子表达式。
 *
 * 支持格式示例：
 * - `d20`
 * - `2d6 + 4`
 * - `(d20 + 4) * d6`
 *
 * 注意：裸数字始终表示常量数字，
 * 如果需要表示骰子，必须显式使用 `d20` 或 `2d6` 这类写法。
 */
export default class DiceGroup {
  /** 当前表达式中展开后的骰子列表。 */
  private dices: Dice[];
  /** 当前表达式组对应的表达式树。 */
  private expression: DiceExpression;

  /**
   * 通过骰子数组创建表达式组，默认按加法串联。
   * @param dices 骰子数组
   */
  constructor(dices: Dice[]);
  /**
   * 复制一个已有的骰子表达式组。
   * @param dices 另一个骰子表达式组
   */
  constructor(dices: DiceGroup);
  /**
   * 通过表达式字符串创建骰子表达式组。
   * @param expression 骰子表达式字符串
   */
  constructor(expression: string);
  constructor(args: Dice[] | DiceGroup | string) {
    if (Array.isArray(args)) {
      if (args.length === 0) {
        throw new Error("DiceGroup 至少需要一个骰子");
      }
      this.dices = [...args];
      this.expression = DiceGroup.expressionFromDices(args);
      return;
    }

    if (typeof args === "string") {
      this.expression = DiceGroup.parse(args);
      this.dices = DiceGroup.collectDices(this.expression);
      return;
    }

    this.expression = DiceGroup.cloneExpression(args.expression);
    this.dices = [...args.dices];
  }

  /**
   * 解析骰子表达式字符串并生成表达式树。
   *
   * 解析规则：
   * - 支持 `+`、`-`、`*`
   * - 遵循常规算术优先级
   * - 支持圆括号分组
   * - 支持 `d20`、`2d6` 这类骰子写法
   * - 支持 `6`、`20` 这类常量写法
   *
   * @param expression 待解析的表达式
   * @returns 解析后的表达式树
   */
  static parse(expression: string): DiceExpression {
    const tokens = DiceGroup.tokenize(expression);
    if (tokens.length === 0) {
      throw new Error("骰子表达式不能为空");
    }

    const operators: Array<Token & ({ type: "operator" } | { type: "leftParen" })> = [];
    const operands: DiceExpression[] = [];

    const applyOperator = () => {
      const operatorToken = operators.pop();
      if (!operatorToken || operatorToken.type !== "operator") {
        throw new Error("无效的骰子表达式");
      }

      const right = operands.pop();
      const left = operands.pop();
      if (!left || !right) {
        throw new Error(`运算符 "${operatorToken.value}" 缺少操作数`);
      }

      operands.push({
        type: "binary",
        operator: operatorToken.value,
        left,
        right,
      });
    };

    let expectOperand = true;
    for (const token of tokens) {
      if (token.type === "dice" || token.type === "constant") {
        if (!expectOperand) {
          throw new Error("操作数之间缺少运算符");
        }
        if (token.type === "dice") {
          operands.push({
            type: "dice",
            count: token.count,
            sides: token.sides,
          });
        } else {
          operands.push({
            type: "constant",
            value: token.value,
          });
        }
        expectOperand = false;
        continue;
      }

      if (token.type === "leftParen") {
        if (!expectOperand) {
          throw new Error("\"(\" 前面缺少运算符");
        }
        operators.push(token);
        continue;
      }

      if (token.type === "rightParen") {
        if (expectOperand) {
          throw new Error("括号为空或不完整");
        }
        while (operators.length > 0 && operators[operators.length - 1].type !== "leftParen") {
          applyOperator();
        }
        if (operators.length === 0) {
          throw new Error("右括号不匹配");
        }
        operators.pop();
        expectOperand = false;
        continue;
      }

      if (expectOperand) {
        throw new Error(`运算符 "${token.value}" 缺少左操作数`);
      }

      while (operators.length > 0) {
        const top = operators[operators.length - 1];
        if (top.type !== "operator") {
          break;
        }
        if (OPERATOR_PRIORITY[top.value] < OPERATOR_PRIORITY[token.value]) {
          break;
        }
        applyOperator();
      }
      operators.push(token);
      expectOperand = true;
    }

    if (expectOperand) {
      throw new Error("骰子表达式不能以运算符结尾");
    }

    while (operators.length > 0) {
      const top = operators[operators.length - 1];
      if (top.type === "leftParen") {
        throw new Error("左括号不匹配");
      }
      applyOperator();
    }

    if (operands.length !== 1) {
      throw new Error("无效的骰子表达式");
    }

    return operands[0];
  }

  /**
   * 获取当前表达式树的副本。
   * @returns 表达式树副本
   */
  getExpression(): DiceExpression {
    return DiceGroup.cloneExpression(this.expression);
  }

  /**
   * 获取表达式中展开后的骰子列表副本。
   * @returns 骰子数组副本
   */
  getDices(): Dice[] {
    return [...this.dices];
  }

  /**
   * 投掷并直接返回最终总值。
   * @returns 表达式求值结果
   */
  roll(): number {
    return this.rollDetailed().total;
  }

  /**
   * 投掷表达式并返回总值与详细投掷记录。
   *
   * 常量节点不会出现在 `rolls` 中，因为它们不参与实际投掷。
   *
   * @returns 包含总值与每颗骰子结果的对象
   */
  rollDetailed(): DiceGroupRollResult {
    const rolls: DiceRollDetail[] = [];
    const total = DiceGroup.evaluate(this.expression, rolls);
    return { total, rolls };
  }

  /**
   * 将表达式字符串拆分为词法单元。
   * @param expression 原始表达式
   * @returns 解析得到的 token 列表
   */
  private static tokenize(expression: string): Token[] {
    const normalized = expression.replace(/\s+/g, "");
    const tokens: Token[] = [];

    let index = 0;
    while (index < normalized.length) {
      const current = normalized[index];

      if (current === "(") {
        tokens.push({ type: "leftParen" });
        index += 1;
        continue;
      }

      if (current === ")") {
        tokens.push({ type: "rightParen" });
        index += 1;
        continue;
      }

      if (current === "+" || current === "-" || current === "*") {
        tokens.push({ type: "operator", value: current });
        index += 1;
        continue;
      }

      if (current === "d") {
        const sidesMatch = normalized.slice(index + 1).match(/^\d+/);
        if (!sidesMatch) {
          throw new Error(`索引 ${index} 附近的 "d" 处存在无效的骰子表达式`);
        }
        const sides = toDiceSide(Number(sidesMatch[0]));
        tokens.push({ type: "dice", count: 1, sides });
        index += sidesMatch[0].length + 1;
        continue;
      }

      if (/\d/.test(current)) {
        const numberMatch = normalized.slice(index).match(/^\d+/);
        if (!numberMatch) {
          throw new Error(`索引 ${index} 处的数字是无效的`);
        }

        const firstNumber = Number(numberMatch[0]);
        index += numberMatch[0].length;

        if (normalized[index] === "d") {
          const sidesMatch = normalized.slice(index + 1).match(/^\d+/);
          if (!sidesMatch) {
            throw new Error(`索引 ${index} 附近的骰子表达式是无效的`);
          }
          const count = firstNumber;
          if (!Number.isInteger(count) || count <= 0) {
            throw new Error(`骰子数量 ${count} 是无效的`);
          }
          const sides = toDiceSide(Number(sidesMatch[0]));
          tokens.push({ type: "dice", count, sides });
          index += sidesMatch[0].length + 1;
          continue;
        }

        tokens.push({
          type: "constant",
          value: firstNumber,
        });
        continue;
      }

      throw new Error(`索引 ${index} 处的字符 "${current}" 是无效的`);
    }

    return tokens;
  }

  /**
   * 将骰子数组转换为仅由加法连接的表达式树。
   * @param dices 骰子数组
   * @returns 对应的表达式树
   */
  private static expressionFromDices(dices: Dice[]): DiceExpression {
    const [first, ...rest] = dices;
    let expression: DiceExpression = {
      type: "dice",
      count: 1,
      sides: first.getSides(),
    };

    for (const dice of rest) {
      expression = {
        type: "binary",
        operator: "+",
        left: expression,
        right: {
          type: "dice",
          count: 1,
          sides: dice.getSides(),
        },
      };
    }

    return expression;
  }

  /**
   * 从表达式树中收集所有需要投掷的骰子。
   *
   * 常量节点不会生成任何骰子实例。
   *
   * @param expression 表达式树
   * @returns 展开的骰子数组
   */
  private static collectDices(expression: DiceExpression): Dice[] {
    if (expression.type === "dice") {
      return Array.from({ length: expression.count }, () => new Dice(expression.sides));
    }
    if (expression.type === "constant") {
      return [];
    }
    return [
      ...DiceGroup.collectDices(expression.left),
      ...DiceGroup.collectDices(expression.right),
    ];
  }

  /**
   * 递归求值表达式，并记录所有实际投掷结果。
   * @param expression 待求值的表达式
   * @param rolls 用于收集投掷明细的数组
   * @returns 当前表达式节点的计算结果
   */
  private static evaluate(expression: DiceExpression, rolls: DiceRollDetail[]): number {
    if (expression.type === "dice") {
      let total = 0;
      for (let index = 0; index < expression.count; index += 1) {
        const value = randomInt(1, expression.sides);
        rolls.push({
          sides: expression.sides,
          value,
        });
        total += value;
      }
      return total;
    }

    if (expression.type === "constant") {
      return expression.value;
    }

    const left = DiceGroup.evaluate(expression.left, rolls);
    const right = DiceGroup.evaluate(expression.right, rolls);

    switch (expression.operator) {
      case "+":
        return left + right;
      case "-":
        return left - right;
      case "*":
        return left * right;
      default:
        throw new Error(`不支持的运算符：${expression.operator}`);
    }
  }

  /**
   * 深拷贝表达式树，避免外部持有内部可变引用。
   * @param expression 原始表达式树
   * @returns 表达式树副本
   */
  private static cloneExpression(expression: DiceExpression): DiceExpression {
    if (expression.type === "dice" || expression.type === "constant") {
      return { ...expression };
    }
    return {
      type: "binary",
      operator: expression.operator,
      left: DiceGroup.cloneExpression(expression.left),
      right: DiceGroup.cloneExpression(expression.right),
    };
  }
}
