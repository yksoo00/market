import { describe, expect, it } from "vitest";
import { formIntercept, linkIntercept, type AnchorInfo, type ClickInfo, type FormInfo } from "./tileNavigation";

const O = "http://h";
const click: ClickInfo = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false };
const anchor: AnchorInfo = { href: `${O}/login`, target: "", hasDownload: false, tileReset: false };
const form: FormInfo = { method: "get", action: `${O}/search`, hasActionAttr: true, defaultPrevented: false, entries: [["q", "LM"], ["field", "all"]] };

describe("linkIntercept", () => {
  it("같은 출처 일반 왼쪽 클릭은 가로챈다", () => {
    expect(linkIntercept(click, anchor, O)).toEqual({ path: "/login", reset: false });
  });

  it("로고(data-tile=reset)는 리셋", () => {
    expect(linkIntercept(click, { ...anchor, href: `${O}/`, tileReset: true }, O)).toEqual({ path: "/", reset: true });
  });

  it("쿼리·해시는 경로에 포함", () => {
    expect(linkIntercept(click, { ...anchor, href: `${O}/a?x=1#y` }, O)).toEqual({ path: "/a?x=1#y", reset: false });
  });

  it("수정키·가운데 클릭·새 탭·다운로드·다른 출처·mailto·이미 처리된 클릭은 브라우저에 맡긴다", () => {
    const cases: [ClickInfo, AnchorInfo][] = [
      [{ ...click, button: 1 }, anchor],
      [{ ...click, metaKey: true }, anchor],
      [{ ...click, ctrlKey: true }, anchor],
      [{ ...click, shiftKey: true }, anchor],
      [{ ...click, altKey: true }, anchor],
      [{ ...click, defaultPrevented: true }, anchor],
      [click, { ...anchor, target: "_blank" }],
      [click, { ...anchor, hasDownload: true }],
      [click, { ...anchor, href: "http://other/login" }],
      [click, { ...anchor, href: "mailto:a@b.c" }],
    ];
    for (const [c, a] of cases) expect(linkIntercept(c, a, O)).toBeNull();
  });

  it("target=_self는 가로챈다", () => {
    expect(linkIntercept(click, { ...anchor, target: "_self" }, O)).toEqual({ path: "/login", reset: false });
  });
});

describe("formIntercept", () => {
  it("GET 폼은 action + 입력값 쿼리", () => {
    expect(formIntercept(form, O)).toEqual({ path: "/search?q=LM&field=all", reset: false });
  });

  it("빈 값도 그대로 싣는다", () => {
    expect(formIntercept({ ...form, entries: [["q", ""]] }, O)).toEqual({ path: "/search?q=", reset: false });
  });

  it("POST·다른 출처(서버 액션 javascript: 포함)는 건드리지 않는다", () => {
    expect(formIntercept({ ...form, method: "post" }, O)).toBeNull();
    expect(formIntercept({ ...form, action: "javascript:throw 1" }, O)).toBeNull();
    expect(formIntercept({ ...form, action: "http://other/search" }, O)).toBeNull();
  });
});

describe("formIntercept — 앱이 직접 처리하는 폼은 건드리지 않음", () => {
  it("action 속성이 없는 폼(onSubmit만 있는 로그인·가입 폼)은 가로채지 않는다", () => {
    expect(formIntercept({ ...form, hasActionAttr: false }, O)).toBeNull();
  });

  it("앱이 이미 preventDefault 한 제출은 가로채지 않는다", () => {
    expect(formIntercept({ ...form, defaultPrevented: true }, O)).toBeNull();
  });
});
