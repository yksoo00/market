import { describe, expect, it } from "vitest";
import { initialOf } from "./userMenu";

describe("initialOf", () => {
  it("한글은 첫 글자", () => {
    expect(initialOf("홍길동")).toBe("홍");
  });

  it("영문은 대문자로", () => {
    expect(initialOf("kim")).toBe("K");
  });

  it("앞뒤 공백은 무시", () => {
    expect(initialOf("  민수 ")).toBe("민");
  });

  it("이모지(서로게이트 쌍)가 깨지지 않는다", () => {
    expect(initialOf("😀웃음")).toBe("😀");
  });

  it("빈 문자열·공백뿐이면 ?", () => {
    expect(initialOf("")).toBe("?");
    expect(initialOf("   ")).toBe("?");
  });
});
