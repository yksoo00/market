import { afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "./uuid";

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("randomUUID", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("보안 컨텍스트에서는 내장 randomUUID 를 쓴다", () => {
    expect(randomUUID()).toMatch(V4);
  });

  it("randomUUID 가 없어도(http 사설 IP) v4 형식의 서로 다른 값을 만든다", () => {
    vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });
    const a = randomUUID();
    const b = randomUUID();
    expect(a).toMatch(V4);
    expect(b).toMatch(V4);
    expect(a).not.toBe(b);
  });
});
