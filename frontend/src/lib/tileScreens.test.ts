import { describe, expect, it } from "vitest";
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
