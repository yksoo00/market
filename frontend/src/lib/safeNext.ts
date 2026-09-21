/** `?next=` 로 받은 경로를 검사. 외부 URL·프로토콜 상대 경로(//evil.com)로의 리다이렉트 방지 */
export function safeNext(raw: string | string[] | undefined, fallback = "/"): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v || !v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return fallback;
  return v;
}
