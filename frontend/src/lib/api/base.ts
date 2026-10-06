/**
 * 브라우저가 부르는 백엔드 주소. NEXT_PUBLIC_API_URL 값으로 정한다 (frontend/.env.local, 커밋하지 않음):
 *  - 없음: http://localhost:8080 (기본값)
 *  - 주소: 그 주소 (운영: 별도 API 도메인)
 *  - same-origin 또는 빈 값: 빈 문자열 → 지금 접속한 주소의 /api 로 부른다. next.config.ts 가 /api 를 백엔드로 넘겨 주므로
 *    같은 개발 서버를 localhost 와 다른 주소(VM 의 사설 IP 등)로 함께 써도 API 주소를 따로 맞출 필요가 없다
 */
export function resolveApiBase(env: string | undefined): string {
  if (env === undefined) return "http://localhost:8080";
  const value = env.trim();
  if (value === "" || value === "same-origin") return "";
  return value.replace(/\/+$/, "");
}
