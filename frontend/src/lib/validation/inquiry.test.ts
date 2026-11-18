import { describe, expect, it } from "vitest";
import { inquiryReplySchema, inquirySchema } from "@/lib/validation/inquiry";

const ok = (title: string, content: string) => inquirySchema.safeParse({ title, content }).success;
const replyOk = (content: string) => inquiryReplySchema.safeParse({ content }).success;

describe("문의 입력 검증 (백엔드와 같은 수치)", () => {
  it("제목 100자 통과, 101자 실패", () => {
    expect(ok("가".repeat(100), "내용")).toBe(true);
    expect(ok("가".repeat(101), "내용")).toBe(false);
  });

  it("내용 2000자 통과, 2001자 실패", () => {
    expect(ok("제목", "a".repeat(2000))).toBe(true);
    expect(ok("제목", "a".repeat(2001))).toBe(false);
  });

  it("답글 1000자 통과, 1001자 실패", () => {
    expect(replyOk("a".repeat(1000))).toBe(true);
    expect(replyOk("a".repeat(1001))).toBe(false);
  });

  it("공백만(전각 공백 포함)이면 실패", () => {
    expect(ok("   ", "내용")).toBe(false);
    expect(ok("제목", "　")).toBe(false);
    expect(replyOk("   ")).toBe(false);
    expect(replyOk("")).toBe(false);
  });

  it("앞뒤 공백까지 원문이 101자면 실패 — 서버 @Size 와 같은 결과", () => {
    expect(ok("a" + " ".repeat(100), "내용")).toBe(false);
  });

  it("이모지는 UTF-16 길이로 센다: 50개(100)는 통과, 51개는 실패", () => {
    expect(ok("😀".repeat(50), "내용")).toBe(true);
    expect(ok("😀".repeat(51), "내용")).toBe(false);
  });

  it("실패 문구는 messages 에서 온다", () => {
    const r = inquirySchema.safeParse({ title: "", content: "내용" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("제목을 입력하세요");
  });
});
