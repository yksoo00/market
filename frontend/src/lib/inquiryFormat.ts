// 문의 글·답글 시각 표시. 서버는 UTC(Instant) 로 주고 표시 변환은 프론트가 한다 (rules/backend.md). 한국 시간 "2026-11-18 14:05"
const formatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatInquiryTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : formatter.format(date);
}
