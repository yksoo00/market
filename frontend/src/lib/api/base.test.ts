import { describe, expect, it } from "vitest";
import { resolveApiBase } from "./base";

describe("resolveApiBase", () => {
  it("설정이 없으면 로컬 백엔드 (지금까지의 기본값)", () => {
    expect(resolveApiBase(undefined)).toBe("http://localhost:8080");
  });

  it("주소가 있으면 그대로, 끝 슬래시만 뗀다", () => {
    expect(resolveApiBase("https://api.example.com")).toBe("https://api.example.com");
    expect(resolveApiBase("https://api.example.com/")).toBe("https://api.example.com");
  });

  it("same-origin(또는 빈 값)이면 빈 문자열 — 같은 주소의 /api 로 부른다 (Next 프록시)", () => {
    expect(resolveApiBase("same-origin")).toBe("");
    expect(resolveApiBase("")).toBe("");
    expect(resolveApiBase("  ")).toBe("");
  });
});
