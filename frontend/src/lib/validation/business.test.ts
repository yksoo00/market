import { afterEach, describe, expect, it, vi } from "vitest";
import { businessSignupSchema, type BusinessSignupInput } from "./business";

const valid: BusinessSignupInput = {
  contactName: "김담당",
  phonePrefix: "010",
  phoneMid: "5555",
  phoneLast: "6666",
  emailLocal: "owner",
  emailDomain: "naver.com",
  emailCustom: "",
  contactMethod: "1",
  loginId: "acme01",
  password: "Str0ng-pass!",
  passwordConfirm: "Str0ng-pass!",
  bizNo: "123-45-67890",
  bizType: "corporation",
  companyName: "테스트상사",
  startDate: "2020-01-01",
  companyTel: "",
  address: "서울 중구 세종대로 110",
  addressDetail: "3층",
  agreeTerms: true,
  agreePrivacy: true,
};

const issuesOf = (patch: Partial<BusinessSignupInput>) => {
  const r = businessSignupSchema.safeParse({ ...valid, ...patch });
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
};

describe("businessSignupSchema", () => {
  afterEach(() => vi.useRealTimers());

  it("모두 채우면 통과", () => {
    expect(issuesOf({})).toEqual([]);
  });

  it("비밀번호에 아이디·사업자번호가 들어가면 password 오류 (백엔드와 같은 규칙)", () => {
    expect(issuesOf({ password: "Acme01-pass!", passwordConfirm: "Acme01-pass!" })).toContain("password");
    expect(issuesOf({ password: "x1234567890!", passwordConfirm: "x1234567890!" })).toContain("password");
  });

  it("개업년월일은 한국 날짜로 오늘 이전만 — UTC 16:00 은 한국 다음 날 01:00", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-07T16:00:00Z"));
    expect(issuesOf({ startDate: "2026-10-07" })).toEqual([]);
    expect(issuesOf({ startDate: "2026-10-08" })).toEqual(["startDate"]);
    expect(issuesOf({ startDate: "" })).toContain("startDate");
  });

  it("필수 약관 둘 다 동의해야 한다", () => {
    expect(issuesOf({ agreeTerms: false, agreePrivacy: false })).toEqual(["agreeTerms", "agreePrivacy"]);
  });

  it("주소 + 상세주소 합이 200자를 넘으면 상세주소 칸에 오류", () => {
    expect(issuesOf({ address: "가".repeat(150), addressDetail: "나".repeat(60) })).toEqual(["addressDetail"]);
  });
});
