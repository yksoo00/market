import { describe, expect, it } from "vitest";
import {
  initialTileWorkspaceState,
  openTileLink,
  closeTile,
  promoteTile,
  resetTiles,
  updateTilePath,
} from "./tileWorkspace";

describe("openTileLink", () => {
  it("0개 -> 1개: 새 타일이 secondary[0]", () => {
    const s = openTileLink(initialTileWorkspaceState, "/a", "k1");
    expect(s.secondary).toEqual([{ path: "/a", key: "k1" }]);
  });

  it("1개 -> 2개: 새 타일이 앞, 기존은 뒤", () => {
    const s0 = openTileLink(initialTileWorkspaceState, "/a", "k1");
    const s1 = openTileLink(s0, "/b", "k2");
    expect(s1.secondary).toEqual([
      { path: "/b", key: "k2" },
      { path: "/a", key: "k1" },
    ]);
  });

  it("2개 가득 -> FIFO: 새 타일 앞, 기존[0]은 뒤로, 기존[1] 제거", () => {
    let s = openTileLink(initialTileWorkspaceState, "/a", "k1");
    s = openTileLink(s, "/b", "k2");
    s = openTileLink(s, "/c", "k3");
    expect(s.secondary).toEqual([
      { path: "/c", key: "k3" },
      { path: "/b", key: "k2" },
    ]);
  });

  it("이미 떠 있는 경로를 다시 열면 중복 항목으로 추가된다", () => {
    const s0 = openTileLink(initialTileWorkspaceState, "/a", "k1");
    const s1 = openTileLink(s0, "/a", "k2");
    expect(s1.secondary).toEqual([
      { path: "/a", key: "k2" },
      { path: "/a", key: "k1" },
    ]);
  });
});

describe("closeTile", () => {
  it("해당 key 제거, 나머지는 순서 유지", () => {
    let s = openTileLink(initialTileWorkspaceState, "/a", "k1");
    s = openTileLink(s, "/b", "k2");
    const result = closeTile(s, "k2");
    expect(result.secondary).toEqual([{ path: "/a", key: "k1" }]);
  });

  it("없는 key는 상태 그대로 반환", () => {
    const s = openTileLink(initialTileWorkspaceState, "/a", "k1");
    expect(closeTile(s, "none")).toEqual(s);
  });
});

describe("promoteTile", () => {
  it("해당 key 자리를 replacementPath/Key로 교체", () => {
    let s = openTileLink(initialTileWorkspaceState, "/a", "k1");
    s = openTileLink(s, "/b", "k2");
    const result = promoteTile(s, "k2", "/old-main", "k-new");
    expect(result.secondary).toEqual([
      { path: "/old-main", key: "k-new" },
      { path: "/a", key: "k1" },
    ]);
  });

  it("없는 key면 상태 그대로 반환", () => {
    const s = openTileLink(initialTileWorkspaceState, "/a", "k1");
    expect(promoteTile(s, "none", "/x", "k-new")).toEqual(s);
  });
});

describe("updateTilePath", () => {
  it("해당 key 타일의 path만 바꾸고 나머지·순서는 그대로", () => {
    let s = openTileLink(initialTileWorkspaceState, "/a", "k1");
    s = openTileLink(s, "/b", "k2");
    const result = updateTilePath(s, "k1", "/a/detail?tab=spec");
    expect(result.secondary).toEqual([
      { path: "/b", key: "k2" },
      { path: "/a/detail?tab=spec", key: "k1" },
    ]);
    expect(result.secondary[0]).toBe(s.secondary[0]);
  });

  it("없는 key면 상태 그대로 반환", () => {
    const s = openTileLink(initialTileWorkspaceState, "/a", "k1");
    expect(updateTilePath(s, "none", "/x")).toBe(s);
  });

  it("경로가 같으면 상태 그대로 반환", () => {
    const s = openTileLink(initialTileWorkspaceState, "/a", "k1");
    expect(updateTilePath(s, "k1", "/a")).toBe(s);
  });
});

describe("resetTiles", () => {
  it("빈 상태를 반환", () => {
    expect(resetTiles()).toEqual({ secondary: [] });
  });
});
