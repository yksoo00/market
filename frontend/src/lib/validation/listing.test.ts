import { describe, expect, it } from "vitest";
import { emptyListingForm, listingFormSchema, PROD_STATES, type ListingFormInput } from "./listing";

const schema = listingFormSchema("2026-10-02");
const valid: ListingFormInput = {
  ...emptyListingForm,
  categoryCode: "ELEC0001",
  prodName: "PowerEdge R740",
  prodBrand: "Dell",
  prodState: "신품",
  salesUnitPrice: "1000",
  salesQuantity: "1",
};
const parse = (over: Partial<ListingFormInput>) => schema.safeParse({ ...valid, ...over });

/** 오류가 난 경로 목록 */
const errorPaths = (over: Partial<ListingFormInput>) => {
  const r = parse(over);
  return r.success ? [] : [...new Set(r.error.issues.map((i) => i.path.join(".")))];
};

describe("listingFormSchema", () => {
  it("필수 칸만 채우면 성공", () => {
    expect(parse({}).success).toBe(true);
  });

  it("필수 칸이 비면 그 칸에 오류", () => {
    for (const name of ["categoryCode", "prodName", "prodBrand", "salesUnitPrice", "salesQuantity"] as const) {
      expect(errorPaths({ [name]: "" })).toEqual([name]);
    }
  });

  it("문자열은 앞뒤 공백을 지우고 길이를 센다", () => {
    expect(parse({ prodName: "  a  " }).data?.prodName).toBe("a");
    expect(errorPaths({ prodName: "   " })).toEqual(["prodName"]);
    expect(errorPaths({ prodName: "가".repeat(51) })).toEqual(["prodName"]);
    expect(errorPaths({ categoryCode: "A".repeat(11) })).toEqual(["categoryCode"]);
    expect(errorPaths({ prodNo: "A".repeat(21) })).toEqual(["prodNo"]);
    expect(errorPaths({ prodSpecInfo: "A".repeat(101) })).toEqual(["prodSpecInfo"]);
    expect(errorPaths({ description: "A".repeat(201) })).toEqual(["description"]);
    expect(parse({ prodName: "가".repeat(50), description: "A".repeat(200) }).success).toBe(true);
  });

  it("단가 0~10억, 수량 1~100,000 정수", () => {
    expect(parse({ salesUnitPrice: "0" }).data?.salesUnitPrice).toBe(0);
    expect(parse({ salesUnitPrice: "1000000000" }).data?.salesUnitPrice).toBe(1_000_000_000);
    for (const bad of ["1000000001", "1,000", "-1", "1.5", "1e3", " 5"]) {
      expect(errorPaths({ salesUnitPrice: bad })).toEqual(["salesUnitPrice"]);
    }
    expect(parse({ salesQuantity: "100000" }).data?.salesQuantity).toBe(100_000);
    for (const bad of ["0", "100001"]) {
      expect(errorPaths({ salesQuantity: bad })).toEqual(["salesQuantity"]);
    }
  });

  it("재고·최소주문량·주문단위는 비우면 undefined, 범위 밖이면 오류", () => {
    const d = parse({}).data;
    expect([d?.stockQuantity, d?.minOrderQuantity, d?.orderUnit]).toEqual([undefined, undefined, undefined]);
    expect(parse({ stockQuantity: "0" }).data?.stockQuantity).toBe(0);
    expect(errorPaths({ stockQuantity: "100001" })).toEqual(["stockQuantity"]);
    expect(errorPaths({ minOrderQuantity: "0" })).toEqual(["minOrderQuantity"]);
    expect(errorPaths({ orderUnit: "100001" })).toEqual(["orderUnit"]);
  });

  it("최소주문량이 판매수량보다 크면 최소주문량 칸에 오류", () => {
    expect(errorPaths({ salesQuantity: "5", minOrderQuantity: "6" })).toEqual(["minOrderQuantity"]);
    expect(parse({ salesQuantity: "5", minOrderQuantity: "5" }).success).toBe(true);
  });

  it("상품상태는 드롭다운 값만, 안 고르면 필수 오류", () => {
    for (const ok of PROD_STATES) expect(parse({ prodState: ok }).success).toBe(true);
    expect(errorPaths({ prodState: "" })).toEqual(["prodState"]);
    expect(errorPaths({ prodState: "신품대비 70%" })).toEqual(["prodState"]);
  });

  it("제조일은 오늘까지, 납기일은 오늘부터, 없는 날짜 거부", () => {
    expect(parse({ prodMufcDate: "2026-10-02" }).success).toBe(true);
    expect(errorPaths({ prodMufcDate: "2026-10-03" })).toEqual(["prodMufcDate"]);
    expect(parse({ deliveryDate: "2026-10-02" }).success).toBe(true);
    expect(errorPaths({ deliveryDate: "2026-10-01" })).toEqual(["deliveryDate"]);
    expect(errorPaths({ prodMufcDate: "2026-02-30" })).toEqual(["prodMufcDate"]);
    expect(errorPaths({ deliveryDate: "2027-02-30" })).toEqual(["deliveryDate"]);
  });

  it("사진은 4장까지", () => {
    expect(parse({ photos: ["a", "b", "c", "d"] }).success).toBe(true);
    expect(errorPaths({ photos: ["a", "b", "c", "d", "e"] })).toEqual(["photos"]);
  });
});
