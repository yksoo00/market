const won = new Intl.NumberFormat("ko-KR");

export function formatPrice(price: number | null, fallback = "가격 제안"): string {
  return price === null ? fallback : won.format(price);
}

export function formatRelative(iso: string, now = new Date()): string {
  const sec = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "방금 전";
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
  return `${Math.floor(sec / 86400)}일 전`;
}
