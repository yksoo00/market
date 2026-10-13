import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isRelated, screenOf } from "./tileScreens";

describe("screenOf", () => {
  it("공통 화면", () => {
    expect(screenOf("/")).toEqual({ id: "home", group: "common" });
    expect(screenOf("/login/find-id")).toEqual({ id: "login", group: "common" });
    expect(screenOf("/signup/personal/form?x=1")).toEqual({ id: "signup", group: "common" });
    expect(screenOf("/listings/u1/20261001090000")).toEqual({ id: "listingDetail", group: "common" });
  });

  it("구매 화면", () => {
    expect(screenOf("/search?q=LM")).toEqual({ id: "search", group: "buy" });
    expect(screenOf("/requests/new")).toEqual({ id: "buyRequest", group: "buy" });
    expect(screenOf("/quotes")).toEqual({ id: "buyQuotes", group: "buy" });
  });

  it("판매 화면은 더 구체적인 경로가 먼저 맞는다", () => {
    expect(screenOf("/quotes/adjust")).toEqual({ id: "sellQuote", group: "sell" });
    expect(screenOf("/listings/new")).toEqual({ id: "sellNew", group: "sell" });
    expect(screenOf("/listings/extra")).toEqual({ id: "sellExtra", group: "sell" });
    expect(screenOf("/my/listings?q=R740")).toEqual({ id: "myListings", group: "sell" });
  });

  it("마이페이지는 공통이라 어느 칸 옆에도 반반으로 열린다", () => {
    expect(screenOf("/my")).toEqual({ id: "my", group: "common" });
    expect(screenOf("/my/purchases")).toEqual({ id: "myPurchases", group: "buy" });
    expect(isRelated(screenOf("/my"), [screenOf("/"), screenOf("/search")])).toBe(true);
  });

  it("수정·판매정보 추가 입력은 상세와 다른 판매 화면", () => {
    expect(screenOf("/listings/u1/20261001090000/edit")).toEqual({ id: "listingEdit", group: "sell" });
    expect(screenOf("/listings/u1/20261001090000/extra")).toEqual({ id: "listingExtraForm", group: "sell" });
  });

  it("표에 없으면 경로 자체가 화면, 그룹 없음 (쿼리·해시 무시)", () => {
    expect(screenOf("/prices")).toEqual({ id: "/prices", group: null });
    expect(screenOf("/prices?x=1#y")).toEqual({ id: "/prices", group: null });
  });
});

describe("isRelated", () => {
  const home = screenOf("/");
  const login = screenOf("/login");
  const search = screenOf("/search");

  it("공통 화면은 항상 연관", () => {
    expect(isRelated(login, [search])).toBe(true);
  });

  it("공통이 아닌 열린 칸의 그룹과 같으면 연관", () => {
    expect(isRelated(screenOf("/quotes"), [home, search])).toBe(true);
    expect(isRelated(search, [home, login])).toBe(true);
  });

  it("그룹이 다르면 연관 없음", () => {
    expect(isRelated(screenOf("/listings/new"), [home, search])).toBe(false);
  });

  it("그룹 없는 화면은 자기 화면만 연관", () => {
    expect(isRelated(screenOf("/prices"), [home])).toBe(false);
    expect(isRelated(screenOf("/prices"), [screenOf("/prices?a=1")])).toBe(true);
  });
});

// 새 화면(page.tsx)을 만들고 표에 안 넣으면 그 화면은 열 때마다 리셋(전체화면)된다 — 마이페이지가 그랬다.
// 표에 없는 화면이 생기면 여기서 실패시켜, 화면을 만들 때 분할 그룹을 같이 정하게 한다.
describe("모든 화면이 표에 있다", () => {
  const appDir = fileURLToPath(new URL("../app", import.meta.url));
  const routes = readdirSync(appDir, { recursive: true, encoding: "utf8" })
    .map((file) => file.replaceAll("\\", "/"))
    .filter((file) => /(^|\/)page\.(tsx|ts|jsx|js|mdx)$/.test(file))
    .map((file) =>
      `/${file.replace(/\/?page\.\w+$/, "")}`
        .split("/")
        .filter((seg) => !/^\(.+\)$/.test(seg)) // (auth) 같은 라우트 그룹은 주소에 안 나온다
        .map((seg) => (/^\[.+\]$/.test(seg) ? "x1" : seg))
        .join("/") || "/",
    );

  it("화면을 하나 이상 찾는다", () => {
    expect(routes).toContain("/");
  });

  it.each(routes)("%s", (route) => {
    expect(screenOf(route).group, `${route} 를 tileScreens.ts SCREENS 에 추가하세요`).not.toBeNull();
  });
});
