import { describe, expect, it } from "vitest";
import { listingEditSchema } from "./listingEdit";
import type { ListingEditValues } from "@/lib/listingEdit";

const today = "2026-10-02";
const base: ListingEditValues = {
  prodState: "신품",
  salesUnitPrice: "1000",
  salesQuantity: "10",
  stockQuantity: "10",
  minOrderQuantity: "1",
  orderUnit: "1",
  deliveryDate: "",
  description: "",
  photos: [],
  listingDataSheet: "",
};

const parse = (over: Partial<ListingEditValues>, initialDelivery = "") =>
  listingEditSchema(today, initialDelivery).safeParse({ ...base, ...over });
const errorPaths = (over: Partial<ListingEditValues>, initialDelivery = "") => {
  const r = parse(over, initialDelivery);
  return r.success ? [] : [...new Set(r.error.issues.map((i) => i.path.join(".")))];
};

describe("listingEditSchema", () => {
  it("정상 값은 통과하고 값은 문자열 그대로", () => {
    const r = parse({});
    expect(r.success).toBe(true);
    expect(r.data?.salesUnitPrice).toBe("1000");
  });

  it("수정에서는 재고·최소주문량·주문단위가 필수", () => {
    expect(errorPaths({ stockQuantity: "" })).toEqual(["stockQuantity"]);
    expect(errorPaths({ minOrderQuantity: "" })).toEqual(["minOrderQuantity"]);
    expect(errorPaths({ orderUnit: "" })).toEqual(["orderUnit"]);
  });

  it("숫자 칸은 숫자만(1e3·쉼표 거부), 범위를 지킨다", () => {
    expect(errorPaths({ salesUnitPrice: "1e3" })).toEqual(["salesUnitPrice"]);
    expect(errorPaths({ salesUnitPrice: "1,000" })).toEqual(["salesUnitPrice"]);
    expect(errorPaths({ salesUnitPrice: "1000000001" })).toEqual(["salesUnitPrice"]);
    expect(errorPaths({ salesQuantity: "0" })).toEqual(["salesQuantity"]);
    expect(errorPaths({ stockQuantity: "100001" })).toEqual(["stockQuantity"]);
    expect(parse({ stockQuantity: "0" }).success).toBe(true);
  });

  it("최소주문량이 판매수량보다 크면 최소주문량 칸 오류", () => {
    expect(errorPaths({ salesQuantity: "5", minOrderQuantity: "6" })).toEqual(["minOrderQuantity"]);
  });

  it("상품상태는 목록 값만 — 옛 값이 매핑되지 않아 빈 값이면 오류", () => {
    expect(errorPaths({ prodState: "" })).toEqual(["prodState"]);
    expect(errorPaths({ prodState: "신품대비 70%" })).toEqual(["prodState"]);
    expect(parse({ prodState: "신품대비 70~79%" }).success).toBe(true);
  });

  it("납기일은 비우기·오늘 이후 통과, 지난 날짜는 오류", () => {
    expect(parse({ deliveryDate: "" }).success).toBe(true);
    expect(parse({ deliveryDate: "2026-10-02" }).success).toBe(true);
    expect(errorPaths({ deliveryDate: "2026-10-01" })).toEqual(["deliveryDate"]);
    expect(errorPaths({ deliveryDate: "2026-02-30" })).toEqual(["deliveryDate"]);
  });

  it("납기일이 처음 값 그대로면 지난 날짜여도 통과 (다른 칸 수정이 막히지 않게)", () => {
    expect(parse({ deliveryDate: "2020-01-01" }, "2020-01-01").success).toBe(true);
    expect(errorPaths({ deliveryDate: "2020-01-02" }, "2020-01-01")).toEqual(["deliveryDate"]);
  });

  it("설명은 200자 이하, 사진은 4장 이하", () => {
    expect(errorPaths({ description: "가".repeat(201) })).toEqual(["description"]);
    expect(parse({ description: "가".repeat(200) }).success).toBe(true);
    expect(errorPaths({ photos: ["a", "b", "c", "d", "e"] })).toEqual(["photos"]);
  });
});
