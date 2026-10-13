const won = new Intl.NumberFormat("ko-KR");

export function formatPrice(price: number | null, fallback = "가격 제안"): string {
  return price === null ? fallback : won.format(price);
}
