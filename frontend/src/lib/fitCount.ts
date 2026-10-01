/** 높이 안에 잘리지 않고 들어가는 행 수 */
export function fitCount(height: number, rowHeight: number): number {
  if (rowHeight <= 0) return 0;
  return Math.max(0, Math.floor(height / rowHeight));
}
