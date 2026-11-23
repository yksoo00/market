import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// crypto.randomUUID 는 보안 컨텍스트(https·localhost)에서만 있다. http 로 사설 IP 에 접속하는 개발·시연 환경에서는 undefined 라
// 견적·구매 창이 "crypto.randomUUID is not a function" 으로 죽었다. 화면 코드는 lib/uuid.ts 의 randomUUID 만 쓴다.
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
  });
}

describe("crypto.randomUUID 직접 호출 금지", () => {
  it("lib/uuid.ts 밖에서는 crypto.randomUUID 를 직접 부르지 않는다", () => {
    const offenders = sources("src")
      .filter((p) => !p.replaceAll("\\", "/").endsWith("src/lib/uuid.ts"))
      .filter((p) => /crypto\.randomUUID\s*\(/.test(readFileSync(p, "utf8")));
    expect(offenders).toEqual([]);
  });
});
