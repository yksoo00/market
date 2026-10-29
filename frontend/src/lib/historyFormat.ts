/** 확정일시 yyyyMMddHHmmss → "2026-10-15 12:00". 14자리 숫자가 아니면 받은 그대로 (깨진 값을 지어내지 않는다) */
export function formatTradeDate(tradeDate: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})\d{2}$/.exec(tradeDate);
  return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}` : tradeDate;
}
