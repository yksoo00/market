import { describe, expect, it } from "vitest";
import {
  applyOpen,
  closePane,
  decideOpen,
  HOME_KEY,
  paneNavigated,
  restorePanes,
  serializePanes,
  syncMainPath,
  type Pane,
} from "./tileQueue";

// 칸 = [주기능, 보조?]. 홈은 칸 목록 밖(넓은 화면에서 왼쪽에 고정)
const P = (key: string, path: string): Pane => ({ key, path });
const wide = { reset: false, wide: true };
const DETAIL = "/listings/3f2b6c1e-8a4d-4f7b-9c21-5d0e7a9b1c11/20261001091500";

describe("decideOpen — 홈 칸·헤더에서 열기 (새 주기능)", () => {
  it("홈 한 칸에서 열면 새 주기능 → 홈 | X", () => {
    expect(decideOpen([P("a", "/")], "a", "/search?q=1", wide)).toEqual({ kind: "main", path: "/search?q=1" });
  });

  it("홈 칸에서 다른 기능을 열면 보조까지 지우고 새 주기능", () => {
    expect(decideOpen([P("a", "/search"), P("b", DETAIL)], HOME_KEY, "/my/listings", wide)).toEqual({
      kind: "main",
      path: "/my/listings",
    });
  });

  it("홈 칸에서 같은 기능을 다시 열어도(다시 검색) 새 주기능 — 옛 결과의 보조는 닫힌다", () => {
    expect(decideOpen([P("a", "/search?q=1"), P("b", DETAIL)], HOME_KEY, "/search?q=2", wide)).toEqual({ kind: "main", path: "/search?q=2" });
  });

  it("관련 없는 화면이어도 헤더에서 열면 새 주기능 (예: 판매 등록 중 내 구매목록)", () => {
    expect(decideOpen([P("a", "/listings/new")], HOME_KEY, "/my/purchases", wide)).toEqual({ kind: "main", path: "/my/purchases" });
  });

  it("홈 칸에서 홈은 아무것도 안 함", () => {
    expect(decideOpen([P("a", "/search")], HOME_KEY, "/", wide)).toEqual({ kind: "none" });
  });
});

describe("decideOpen — 주기능·보조 칸에서 열기", () => {
  it("연관 화면은 보조 자리 → 홈 | 주기능 | X", () => {
    expect(decideOpen([P("a", "/search")], "a", DETAIL, wide)).toEqual({ kind: "sub", path: DETAIL });
  });

  it("보조가 있어도 연관 화면이면 보조만 바뀐다", () => {
    expect(decideOpen([P("a", "/search"), P("b", DETAIL)], "a", "/login", wide)).toEqual({ kind: "sub", path: "/login" });
  });

  it("보조 칸에서 연관 화면을 열어도 보조만 바뀐다", () => {
    expect(decideOpen([P("a", "/my/listings"), P("b", DETAIL)], "b", "/listings/new", wide)).toEqual({
      kind: "sub",
      path: "/listings/new",
    });
  });

  it("연관 없는 화면이면 새 주기능 (2·3번 지움)", () => {
    expect(decideOpen([P("a", "/search"), P("b", DETAIL)], "b", "/listings/new", wide)).toEqual({
      kind: "main",
      path: "/listings/new",
    });
  });

  it("표에 없는 화면은 새 주기능", () => {
    expect(decideOpen([P("a", "/search")], "a", "/prices", wide)).toEqual({ kind: "main", path: "/prices" });
  });

  it("같은 화면이면 그 칸에서 이동", () => {
    expect(decideOpen([P("a", "/search"), P("b", "/login")], "b", "/signup/personal/form", wide)).toEqual({
      kind: "inPlace",
      paneKey: "b",
      path: "/signup/personal/form",
    });
  });

  it("보조 칸에서 주기능과 같은 화면을 열면 주기능 칸에서 바뀐다", () => {
    expect(decideOpen([P("a", "/search?q=1"), P("b", DETAIL)], "b", "/search?q=2", wide)).toEqual({
      kind: "inPlace",
      paneKey: "a",
      path: "/search?q=2",
    });
  });

  it("이미 그 주소가 열려 있으면 아무것도 안 함 (다시 불러와 입력값이 지워지지 않게)", () => {
    expect(decideOpen([P("a", "/search"), P("b", "/login")], "a", "/login", wide)).toEqual({ kind: "none" });
    expect(decideOpen([P("a", "/search?q=1")], "a", "/search?q=1", wide)).toEqual({ kind: "none" });
  });

  it("홈 링크는 아무것도 안 함 — 홈은 이미 왼쪽에 보인다 (입력하던 칸이 닫히지 않게)", () => {
    expect(decideOpen([P("a", "/search"), P("b", DETAIL)], "b", "/", wide)).toEqual({ kind: "none" });
  });

  it("로고(reset)는 항상 새 주기능 — 홈이면 홈 한 칸", () => {
    expect(decideOpen([P("a", "/search"), P("b", "/login")], "b", "/", { reset: true, wide: true })).toEqual({ kind: "main", path: "/" });
  });
});

describe("decideOpen — 좁은 화면", () => {
  it("분할하지 않는다: 같은 화면이면 제자리, 아니면 새 주기능", () => {
    expect(decideOpen([P("a", "/search?q=1")], "a", "/search?q=2", { reset: false, wide: false })).toEqual({
      kind: "inPlace",
      paneKey: "a",
      path: "/search?q=2",
    });
    expect(decideOpen([P("a", "/search"), P("b", "/login")], "a", "/login", { reset: false, wide: false })).toEqual({
      kind: "main",
      path: "/login",
    });
  });
});

describe("applyOpen", () => {
  const panes = [P("a", "/search"), P("b", "/login")];

  it("보조는 교체(새 key), 주기능은 보조까지 지움", () => {
    expect(applyOpen(panes, { kind: "sub", path: DETAIL }, "n")).toEqual([P("a", "/search"), P("n", DETAIL)]);
    expect(applyOpen([P("a", "/search")], { kind: "sub", path: DETAIL }, "n")).toEqual([P("a", "/search"), P("n", DETAIL)]);
    expect(applyOpen(panes, { kind: "main", path: "/my" }, "n")).toEqual([P("n", "/my")]);
  });

  it("제자리는 key 그대로, 입력 배열은 바꾸지 않는다", () => {
    expect(applyOpen(panes, { kind: "inPlace", paneKey: "b", path: "/login/find-id" }, "n")).toEqual([
      P("a", "/search"),
      P("b", "/login/find-id"),
    ]);
    expect(panes).toEqual([P("a", "/search"), P("b", "/login")]);
  });
});

describe("closePane", () => {
  it("보조를 닫으면 주기능만, 주기능을 닫으면 홈 한 칸", () => {
    const panes = [P("a", "/search"), P("b", DETAIL)];
    expect(closePane(panes, "b", "n")).toEqual([P("a", "/search")]);
    expect(closePane(panes, "a", "n")).toEqual([P("n", "/")]);
  });

  it("홈 한 칸·모르는 칸은 그대로", () => {
    expect(closePane([P("a", "/")], "a", "n")).toEqual([P("a", "/")]);
    expect(closePane([P("a", "/search")], "x", "n")).toEqual([P("a", "/search")]);
  });
});

describe("syncMainPath", () => {
  it("같은 화면이면 주기능 경로만, 다른 화면이면 새 주기능 (보조 지움)", () => {
    expect(syncMainPath([P("a", "/search?q=1"), P("b", DETAIL)], "/search?q=2", "n")).toEqual([P("a", "/search?q=2"), P("b", DETAIL)]);
    expect(syncMainPath([P("a", "/search"), P("b", DETAIL)], "/listings/new", "n")).toEqual([P("n", "/listings/new")]);
    expect(syncMainPath([P("a", "/search")], "/search", "n")).toEqual([P("a", "/search")]);
  });
});

describe("paneNavigated — iframe 칸이 코드로 다른 곳으로 갔을 때", () => {
  it("같은 화면 안 이동은 경로만 갱신", () => {
    expect(paneNavigated([P("a", "/search"), P("b", "/login")], "b", "/login/find-id", true, "n")).toEqual([
      P("a", "/search"),
      P("b", "/login/find-id"),
    ]);
  });

  it("보조 칸이 다른 화면으로 가면 주기능에서 연 것처럼 — 로그인 성공 후 상세로 돌아가면 보조 자리", () => {
    expect(paneNavigated([P("a", "/search"), P("b", "/login")], "b", DETAIL, true, "n")).toEqual([P("a", "/search"), P("n", DETAIL)]);
  });

  it("홈 칸이 홈 밖으로 가면 새 주기능", () => {
    expect(paneNavigated([P("a", "/search")], HOME_KEY, "/my", true, "n")).toEqual([P("n", "/my")]);
    expect(paneNavigated([P("a", "/search")], HOME_KEY, "/?x=1", true, "n")).toEqual([P("a", "/search")]);
  });

  it("모르는 칸이면 그대로", () => {
    expect(paneNavigated([P("a", "/search")], "x", "/login", true, "n")).toEqual([P("a", "/search")]);
  });
});

describe("serializePanes · restorePanes", () => {
  const panes = [P("a", "/search"), P("b", DETAIL)];

  it("저장한 주기능 칸이 지금 주소와 같으면 복원, 다르면 null", () => {
    expect(restorePanes(serializePanes(panes), "/search")).toEqual(panes);
    expect(restorePanes(serializePanes(panes), "/my")).toBeNull();
  });

  it("홈 한 칸엔 보조를 붙이지 않는다 (큐 시절 [홈, 로그인] 같은 값)", () => {
    expect(restorePanes(serializePanes([P("a", "/"), P("b", "/login")]), "/")).toEqual([P("a", "/")]);
  });

  it("깨졌거나 형식이 다르거나 3칸 이상이면 null", () => {
    for (const raw of [null, "not json", '{"x":1}', '[{"key":1}]', "[]"]) {
      expect(restorePanes(raw, "/")).toBeNull();
    }
    expect(restorePanes(serializePanes([P("a", "/search"), P("b", "/1"), P("c", "/2")]), "/search")).toBeNull();
  });
});
