import { describe, expect, it } from "vitest";
import { pageItems } from "./pager";

describe("pageItems", () => {
  it("한 페이지면 1 하나", () => {
    expect(pageItems(1, 1)).toEqual([1]);
  });

  it("작으면 전부 보인다", () => {
    expect(pageItems(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("멀면 처음·끝과 현재 앞뒤 2칸, 사이는 …", () => {
    expect(pageItems(1, 10)).toEqual([1, 2, 3, "gap", 10]);
    expect(pageItems(6, 12)).toEqual([1, "gap", 4, 5, 6, 7, 8, "gap", 12]);
    expect(pageItems(10, 10)).toEqual([1, "gap", 8, 9, 10]);
  });

  it("한 칸만 비면 …대신 그 번호를 보인다", () => {
    expect(pageItems(5, 8)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(pageItems(4, 9)).toEqual([1, 2, 3, 4, 5, 6, "gap", 9]);
  });
});
