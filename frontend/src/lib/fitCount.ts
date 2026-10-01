/** 높이 안에 잘리지 않고 들어가는 행 수 */
export function fitCount(height: number, rowHeight: number): number {
  if (rowHeight <= 0) return 0;
  // 확대 배율·비율 높이(홈 목록 max-h-[40%])에서는 높이가 167.99처럼 정확한 배수보다 살짝 작게 재진다.
  // 그대로 내림하면 다 들어가는 행 하나를 버리므로 0.5px 여유를 준다 (그만큼 잘려도 눈에 안 보임)
  return Math.max(0, Math.floor((height + 0.5) / rowHeight));
}
