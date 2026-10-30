import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import type { NextConfig } from "next";

// 환경변수는 저장소 루트 .env 하나만 쓴다(사용자 방침). Next 는 frontend/ 밖의 .env 를 읽지 않으므로 여기서 직접 읽는다.
// 프론트에 필요한 키만 process.env 에 옮긴다 — 루트 .env 에는 DB·JWT·메일 비밀값이 있어 Next 서버 프로세스에 통째로 넣지 않는다.
// 이미 있는 값은 덮어쓰지 않아, 셸 환경변수와 frontend/.env* 가 루트 .env 보다 우선한다.
// 루트 .env 가 없는 곳(CI, 컨테이너 빌드)에서는 넘어가고, 다른 오류(깨진 파일 등)는 그대로 던진다. 이 설정 파일은 서버(Node)에서만 돈다
const ROOT_ENV_KEYS = /^(NEXT_PUBLIC_|DEV_ALLOWED_ORIGINS$|API_PROXY_TARGET$)/;
try {
  for (const [key, value] of Object.entries(parseEnv(readFileSync("../.env", "utf8")))) {
    if (ROOT_ENV_KEYS.test(key) && process.env[key] === undefined) process.env[key] = value;
  }
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
}

// 개발 서버를 localhost 말고 다른 주소(VM 의 사설 IP, 포트포워딩 등)로도 쓸 때의 설정. 주소는 코드에 두지 않고
// 루트 .env 에 둔다 (커밋하지 않음). 안 쓰면 아무것도 바뀌지 않는다.
//  - DEV_ALLOWED_ORIGINS: 쉼표로 구분한 호스트 이름(포트 없이). Next 16 개발 서버는 localhost 가 아닌 주소에서 오는 JS 파일 요청을
//    403 으로 막아 hydration 이 안 된다(버튼이 안 눌리고 헤더의 로그인·회원가입이 안 나옴)
//  - NEXT_PUBLIC_API_URL=same-origin: 브라우저는 접속한 주소의 /api 만 부르고, 이 서버가 API_PROXY_TARGET(기본 http://localhost:8080)으로 넘긴다
const devOrigins = (process.env.DEV_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const apiEnv = process.env.NEXT_PUBLIC_API_URL;
const sameOriginApi = apiEnv !== undefined && (apiEnv.trim() === "" || apiEnv.trim() === "same-origin");

// 위에서 읽은 루트 .env 의 NEXT_PUBLIC_* 를 브라우저 번들에 넣는다. Next 가 자기 .env 파일에서 모으는 값만 번들러(Turbopack)에
// 전달해서, 설정 파일이 process.env 에 넣은 값은 이렇게 env 로 넘겨야 클라이언트 코드에 들어간다
const publicEnv = Object.fromEntries(
  Object.entries(process.env).filter((e): e is [string, string] => e[0].startsWith("NEXT_PUBLIC_") && e[1] !== undefined),
);

const nextConfig: NextConfig = {
  env: publicEnv,
  // 개발 서버 왼쪽 아래 Next.js 표시(N)를 숨긴다. 타일 칸(iframe)마다 떠서 화면을 가렸다.
  // 컴파일·런타임 오류는 꺼도 그대로 표시된다
  devIndicators: false,
  allowedDevOrigins: devOrigins,
  // 같은 주소 /api 모드에선 업로드도 이 서버의 프록시를 지난다. 백엔드 요청 한도(11MB)보다 약간 크게 (기본 10MB 는 10MB 파일의 multipart 본문이 잘릴 수 있다)
  experimental: sameOriginApi ? { proxyClientMaxBodySize: "12mb" } : {},
  async rewrites() {
    if (!sameOriginApi) return [];
    return [{ source: "/api/:path*", destination: `${process.env.API_PROXY_TARGET ?? "http://localhost:8080"}/api/:path*` }];
  },
};

export default nextConfig;
