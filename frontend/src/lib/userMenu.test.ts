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

  it("사업자 상호 앞의 (주)·㈜·[주] 는 건너뛴다", () => {
    expect(initialOf("(주)커널")).toBe("커");
    expect(initialOf("㈜커널")).toBe("커");
    expect(initialOf("[주] 커널")).toBe("커");
  });

  it("앞의 기호는 건너뛰고 첫 글자·숫자", () => {
    expect(initialOf("★민수")).toBe("민");
    expect(initialOf("[팀]하나")).toBe("팀");
    expect(initialOf("#7번")).toBe("7");
  });

  it("국기·결합 이모지는 한 덩어리(grapheme)로", () => {
    expect(initialOf("🇰🇷닉")).toBe("🇰🇷");
    expect(initialOf("👨‍👩‍👧가족")).toBe("👨‍👩‍👧");
  });

  it("대문자로 바꾸면 두 글자가 되는 글자는 그대로 (ß → SS 방지)", () => {
    expect(initialOf("ßen")).toBe("ß");
  });

  it("글자가 하나도 없으면 ?", () => {
    expect(initialOf("★★")).toBe("?");
  });
});
