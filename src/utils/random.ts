
/**
 * 生成一个指定区间的随机数, 采用双闭区间 [min, max]
 * @param min 最小值
 * @param max 最大值
 * @returns 随机整数
 */
export function randomInt(min: number, max: number) {
  if (min > max) {
    throw new Error('min must be less than max');
  }
  if (min === max) {
    return min;
  }
  if (min < 0 || max < 0) {
    throw new Error('min and max must be greater than 0');
  }
  return Math.floor(Math.random() * (max - min + 1)) + min;
}