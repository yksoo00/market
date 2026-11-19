import { describe, expect, it } from "vitest";
import { nextSort, sortStateOf, type ColumnSortValues } from "./columnSort";

const price: ColumnSortValues = { asc: "priceAsc", desc: "priceDesc" };
// 등록일: 내림이 곧 기본(최신순)
const regDate: ColumnSortValues = { asc: "regDateAsc", desc: "latest" };

describe("nextSort", () => {
  it("오름 → 내림 → 기본(최신순) → 오름 으로 돈다", () => {
    expect(nextSort("latest", price, "latest")).toBe("priceAsc");
    expect(nextSort("priceAsc", price, "latest")).toBe("priceDesc");
    expect(nextSort("priceDesc", price, "latest")).toBe("latest");
    expect(nextSort("latest", price, "latest")).toBe("priceAsc");
  });

  it("다른 열이 정렬 중이면 이 열의 오름부터", () => {
    expect(nextSort("nameDesc", price, "latest")).toBe("priceAsc");
  });

  it("내림이 기본값인 열(등록일)은 오름 ↔ 내림 두 단계", () => {
    expect(nextSort("latest", regDate, "latest")).toBe("regDateAsc");
    expect(nextSort("regDateAsc", regDate, "latest")).toBe("latest");
  });
});

describe("sortStateOf", () => {
  it("그 열의 정렬이면 오름·내림, 아니면 null", () => {
    expect(sortStateOf("priceAsc", price)).toBe("asc");
    expect(sortStateOf("priceDesc", price)).toBe("desc");
    expect(sortStateOf("latest", price)).toBeNull();
    expect(sortStateOf("nameAsc", price)).toBeNull();
  });

  it("기본(최신순)은 등록일 열의 내림으로 보인다", () => {
    expect(sortStateOf("latest", regDate)).toBe("desc");
    expect(sortStateOf("regDateAsc", regDate)).toBe("asc");
  });
});
