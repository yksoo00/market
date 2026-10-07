// crypto.randomUUID 는 보안 컨텍스트(https·localhost)에서만 있다. http 로 사설 IP 에 접속하는 개발 환경에서는
// undefined 라 화면이 통째로 죽으므로, 어디서나 있는 getRandomValues 로 같은 v4 UUID 를 만든다
export function randomUUID(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
