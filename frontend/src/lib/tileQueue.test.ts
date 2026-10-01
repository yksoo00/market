import { describe, expect, it } from "vitest";
import {
  applyOpen,
  closePane,
  decideOpen,
  paneNavigated,
  restorePanes,
  serializePanes,
  syncMainPath,
  type Pane,
} from "./tileQueue";

const P = (key: string, path: string): Pane => ({ key, path });
const wide = { reset: false, wide: true };

describe("decideOpen", () => {
  it("연관 화면은 맨 뒤에 추가", () => {
    expect(decideOpen([P("a", "/")], "a", "/login", wide)).toEqual({ kind: "push", path: "/login" });
  });

  it("지금 칸과 같은 주소면 아무것도 안 함", () => {
    expect(decideOpen([P("a", "/search?q=1")], "a", "/search?q=1", wide)).toEqual({ kind: "none" });
  });

  it("같은 화면이면 그 칸에서 이동", () => {
    expect(decideOpen([P("a", "/signup")], "a", "/signup/personal/form", wide)).toEqual({
      kind: "inPlace",
      paneKey: "a",
      path: "/signup/personal/form",
    });
  });

  it("같은 화면이 다른 칸에 있으면 그 칸을 바꿈 (두 칸이 되지 않게)", () => {
    expect(decideOpen([P("a", "/"), P("b", "/login")], "a", "/login/find-id", wide)).toEqual({
      kind: "replace",
      paneKey: "b",
      path: "/login/find-id",
    });
  });

  it("연관 없는 화면은 리셋", () => {
    expect(decideOpen([P("a", "/"), P("b", "/search")], "a", "/listings/new", wide)).toEqual({
      kind: "reset",
      path: "/listings/new",
    });
  });

  it("표에 없는 화면은 리셋", () => {
    expect(decideOpen([P("a", "/")], "a", "/prices", wide)).toEqual({ kind: "reset", path: "/prices" });
  });

  it("로고(reset 옵션)는 항상 리셋", () => {
    expect(decideOpen([P("a", "/search"), P("b", "/login")], "b", "/", { reset: true, wide: true })).toEqual({
      kind: "reset",
      path: "/",
    });
  });

  it("좁은 화면은 분할하지 않고 리셋", () => {
    expect(decideOpen([P("a", "/")], "a", "/login", { reset: false, wide: false })).toEqual({
      kind: "reset",
      path: "/login",
    });
  });
});

describe("applyOpen", () => {
  it("가득 찬 상태에서 추가하면 가장 오래된 칸이 빠지고 당겨진다", () => {
    const panes = [P("a", "/"), P("b", "/login"), P("c", "/signup")];
    expect(applyOpen(panes, { kind: "push", path: "/search" }, "d")).toEqual([
      P("b", "/login"),
      P("c", "/signup"),
      P("d", "/search"),
    ]);
  });

  it("추가·리셋", () => {
    expect(applyOpen([P("a", "/"), P("b", "/login")], { kind: "push", path: "/search" }, "n")).toEqual([
      P("a", "/"),
      P("b", "/login"),
      P("n", "/search"),
    ]);
    expect(applyOpen([P("a", "/"), P("b", "/login")], { kind: "reset", path: "/x" }, "n")).toEqual([P("n", "/x")]);
  });

  it("제자리는 key 그대로, 교체는 key도 바뀜 (iframe을 새 경로로 다시 열려고)", () => {
    const panes = [P("a", "/"), P("b", "/login")];
    expect(applyOpen(panes, { kind: "inPlace", paneKey: "a", path: "/?x=1" }, "n")).toEqual([P("a", "/?x=1"), P("b", "/login")]);
    expect(applyOpen(panes, { kind: "replace", paneKey: "b", path: "/login/find-id" }, "n")).toEqual([
      P("a", "/"),
      P("n", "/login/find-id"),
    ]);
  });

  it("입력 배열을 바꾸지 않는다", () => {
    const panes = [P("a", "/")];
    applyOpen(panes, { kind: "push", path: "/login" }, "n");
    expect(panes).toEqual([P("a", "/")]);
  });
});

describe("closePane", () => {
  const panes = [P("a", "/"), P("b", "/login"), P("c", "/signup")];

  it("주소창 칸·가운데 칸 닫기", () => {
    expect(closePane(panes, "a")).toEqual([P("b", "/login"), P("c", "/signup")]);
    expect(closePane(panes, "b")).toEqual([P("a", "/"), P("c", "/signup")]);
  });

  it("한 칸만 남았으면 닫지 않는다", () => {
    expect(closePane([P("a", "/")], "a")).toEqual([P("a", "/")]);
  });
});

describe("syncMainPath", () => {
  it("같은 화면으로 바뀌면 주소창 칸 경로만 갱신", () => {
    expect(syncMainPath([P("a", "/search?q=1"), P("b", "/login")], "/search?q=2", "n")).toEqual([
      P("a", "/search?q=2"),
      P("b", "/login"),
    ]);
  });

  it("이미 같은 주소면 그대로", () => {
    expect(syncMainPath([P("a", "/"), P("b", "/login")], "/", "n")).toEqual([P("a", "/"), P("b", "/login")]);
  });

  it("뒤로가기 등으로 다른 화면이 오면 리셋", () => {
    expect(syncMainPath([P("a", "/"), P("b", "/login")], "/listings/new", "n")).toEqual([P("n", "/listings/new")]);
  });
});

describe("serializePanes · restorePanes", () => {
  const panes = [P("a", "/"), P("b", "/login")];

  it("저장한 주소창 칸이 지금 주소와 같으면 복원", () => {
    expect(restorePanes(serializePanes(panes), "/")).toEqual(panes);
  });

  it("지금 주소가 다르면 복원하지 않음", () => {
    expect(restorePanes(serializePanes(panes), "/search")).toBeNull();
  });

  it("깨졌거나 형식이 다르면 null", () => {
    for (const raw of [null, "not json", '{"x":1}', '[{"key":1}]', "[]"]) {
      expect(restorePanes(raw, "/")).toBeNull();
    }
    const four = serializePanes([P("a", "/"), P("b", "/1"), P("c", "/2"), P("d", "/3")]);
    expect(restorePanes(four, "/")).toBeNull();
  });
});

describe("리뷰 반영", () => {
  it("좁은 화면에선 숨은 칸에 같은 화면이 있어도 교체하지 않고 리셋 (클릭이 무반응처럼 보이지 않게)", () => {
    expect(decideOpen([P("a", "/"), P("b", "/login")], "a", "/login", { reset: false, wide: false })).toEqual({
      kind: "reset",
      path: "/login",
    });
  });

  it("다른 칸에 이미 같은 주소가 열려 있으면 아무것도 안 함 (다시 불러와 입력값이 지워지지 않게)", () => {
    expect(decideOpen([P("a", "/"), P("b", "/login")], "a", "/login", wide)).toEqual({ kind: "none" });
  });
});

describe("paneNavigated — iframe 칸이 코드로(로그인 성공 후 이동 등) 다른 곳으로 갔을 때", () => {
  it("같은 화면 안 이동은 경로만 갱신", () => {
    expect(paneNavigated([P("a", "/"), P("b", "/login")], "b", "/login/find-id", true, "n")).toEqual([
      P("a", "/"),
      P("b", "/login/find-id"),
    ]);
  });

  it("다른 화면으로 가면 그 칸을 닫고 큐 규칙으로 연다 — 로그인 후 홈이면 이미 홈이 있어 칸만 닫힘", () => {
    expect(paneNavigated([P("a", "/"), P("b", "/login")], "b", "/", true, "n")).toEqual([P("a", "/")]);
  });

  it("연관 화면이면 그 자리 대신 큐 뒤에 열린다", () => {
    expect(paneNavigated([P("a", "/search"), P("b", "/login")], "b", "/", true, "n")).toEqual([
      P("a", "/search"),
      P("n", "/"),
    ]);
  });

  it("모르는 칸이면 그대로", () => {
    expect(paneNavigated([P("a", "/")], "x", "/login", true, "n")).toEqual([P("a", "/")]);
  });
});
