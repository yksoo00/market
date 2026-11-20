// 날짜 입력 정리. 서버(common/time/KoreanDates.normalizeDate)와 같은 규칙 — 연 4자리·월 2자리·일 2자리, 사이에 구분 문자
// (공백 - . /) 하나가 있어도 없어도 되고 실제 있는 날짜여야 한다. 구분 문자를 아무 데서나 지우지 않는다
// ("2026-1-111" 이 20261111 로, "2026-03-0a3" 이 엉뚱한 날짜로 조용히 바뀌지 않게).

const DATE_SHAPE = /^\s*(\d{4})[-./\s]?(\d{2})[-./\s]?(\d{2})\s*$/;

/** 올바른 날짜면 화면용 YYYY-MM-DD, 아니면 null. 2026.10.10 · 20261010 · " 2026/10/10 " 모두 2026-10-10 */
export function normalizeDate(s: string): string | null {
  const m = DATE_SHAPE.exec(s);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  // new Date(y, ...) 는 0~99년을 1900년대로 바꾼다 — setFullYear 로 서버(uuuu)와 같게 연도를 그대로 둔다
  const date = new Date(0);
  date.setFullYear(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
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
 * 화면은 달력 입력(type="date")·표시가 YYYY-MM-DD 라, 한 곳(lib/api/client)에서 바꿔 화면 코드를 그대로 둔다.
 * 방금 JSON.parse 한 새 객체라 복사하지 않고 제자리에서 바꾼다 (검색·거래 목록은 커서 한 번에 수백 건)
 */
export function reviveDates<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach(reviveDates);
  } else if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (DATE_KEYS.has(k) && typeof v === "string") obj[k] = displayDate(v);
      else reviveDates(v);
    }
  }
  return value;
}
