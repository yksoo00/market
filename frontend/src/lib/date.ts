// 날짜 입력 정리. 서버(common/time/KoreanDates.normalizeDate)와 같은 규칙 — 구분 문자(공백 - . / : T)만 지우고
// 숫자 8자리의 실제 있는 날짜여야 한다. 글자가 섞이면 지우지 않고 거절한다 ("2026-03-0a3" 이 엉뚱한 날짜가 되지 않게).

const SEPARATORS = /[\s\-./:T]/g;

/** 올바른 날짜면 화면용 YYYY-MM-DD, 아니면 null. 2026.10.10 · 20261010 · " 2026/10/10 " 모두 2026-10-10 */
export function normalizeDate(s: string): string | null {
  const digits = s.replace(SEPARATORS, "");
  if (!/^\d{8}$/.test(digits)) return null;
  const [y, mo, d] = [Number(digits.slice(0, 4)), Number(digits.slice(4, 6)), Number(digits.slice(6, 8))];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

/** 올바른 날짜면 YYYY-MM-DD, 아니면 받은 값 그대로 (뒤의 검증이 형식 오류로 거절한다) */
export function normalizeDateOrKeep(s: string): string {
  return normalizeDate(s) ?? s;
}

/** 서버가 yyyyMMdd(저장 형식)로 보낸 날짜 값을 화면용 YYYY-MM-DD 로. 8자리 숫자가 아니면 그대로 */
export function displayDate(s: string): string {
  return /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s;
}

const DATE_KEYS = new Set(["deliveryDate", "reqDeliDate", "provDate"]);

/**
 * 응답 JSON 의 날짜 칸(제공가능일·납품희망일)을 화면용 YYYY-MM-DD 로 바꾼다. 서버는 yyyyMMdd 로 저장·응답하고
 * 화면은 달력 입력(type="date")·표시가 YYYY-MM-DD 라, 한 곳(lib/api/client)에서 바꿔 화면 코드를 그대로 둔다
 */
export function reviveDates<T>(value: T): T {
  if (Array.isArray(value)) return value.map(reviveDates) as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        DATE_KEYS.has(k) && typeof v === "string" ? displayDate(v) : reviveDates(v),
      ]),
    ) as T;
  }
  return value;
}
