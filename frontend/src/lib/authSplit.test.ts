import { describe, expect, it } from "vitest";
import { closeDestination, nextPrevious, type PreviousPane } from "./authSplit";

const loginPane: PreviousPane = { kind: "login", next: "/me", initial: "business", search: "?next=%2Fme&type=business" };

describe("nextPrevious", () => {
  it("/login에서 가입 링크를 누르면 현재 로그인 화면을 위 칸으로 남긴다 (next·type·search 보존)", () => {
    expect(nextPrevious(null, "/login", "/signup", "?next=%2Fme&type=business")).toEqual(loginPane);
  });

  it("쿼리 없는 /login이면 next는 기본값 /, 개인 탭, search는 빈 문자열", () => {
    expect(nextPrevious(null, "/login", "/signup", "")).toEqual({
      kind: "login",
      next: "/",
      initial: "personal",
      search: "",
    });
  });

  it("안전하지 않은 next(//evil.com)는 기본값으로 바꾼다", () => {
    const pane = nextPrevious(null, "/login", "/signup", "?next=%2F%2Fevil.com");
    expect(pane).toMatchObject({ kind: "login", next: "/" });
  });

  it("가입 유형 선택(/signup)에서 /login 링크를 누르면 가입 선택 화면을 위 칸으로 남긴다", () => {
    expect(nextPrevious(null, "/signup", "/login", "")).toEqual({ kind: "signup" });
  });

  it("같은 흐름 안의 이동(/signup → /signup/personal/form)은 위 칸을 유지한다", () => {
    expect(nextPrevious(loginPane, "/signup", "/signup/personal/form", "")).toBe(loginPane);
  });

  it("흐름을 벗어나면(/signup → /) 위 칸을 닫는다", () => {
    expect(nextPrevious(loginPane, "/signup", "/", "")).toBeNull();
  });

  it("가입 단계 화면에서 /login으로 가면 위 칸을 닫는다 (정확히 /signup일 때만 남긴다)", () => {
    expect(nextPrevious(null, "/signup/personal/form", "/login", "")).toBeNull();
  });

  it("위 칸이 없으면 흐름 안 이동에도 그대로 없다", () => {
    expect(nextPrevious(null, "/login", "/login/find-id", "")).toBeNull();
  });
});

describe("closeDestination", () => {
  it("이전 로그인 칸이 있으면 원래 주소(search 포함)로 돌아간다", () => {
    expect(closeDestination(loginPane)).toBe("/login?next=%2Fme&type=business");
  });

  it("next가 없던 로그인은 ?next=%2F가 붙지 않고 /login 그대로 돌아간다", () => {
    expect(closeDestination({ kind: "login", next: "/", initial: "personal", search: "" })).toBe("/login");
  });

  it("이전 가입 칸이 있으면 /signup으로 돌아간다", () => {
    expect(closeDestination({ kind: "signup" })).toBe("/signup");
  });

  it("위 칸이 없는 단일 칸이면 홈으로 간다", () => {
    expect(closeDestination(null)).toBe("/");
  });
});
