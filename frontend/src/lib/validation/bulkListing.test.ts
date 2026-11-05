import { describe, expect, it } from "vitest";
import { listing } from "@/messages/listing";
import { isXlsx, validateBulkRow, type BulkFields } from "./bulkListing";

const v = listing.validation;
const TODAY = "2026-11-05";
const ok: BulkFields = {
  prodId: "",
  prodName: "스위치 C9300",
  prodBrand: "Cisco",
  prodClassNo: "",
  prodNo: "",
  categoryCode: "",
  prodState: "신품",
  salesUnitPrice: "500000",
  salesQuantity: "3",
  minOrderQuantity: "",
  orderUnit: "",
  deliveryDate: "2026-12-01",
  description: "",
};
const check = (patch: Partial<BulkFields>) => validateBulkRow({ ...ok, ...patch }, TODAY);

describe("validateBulkRow", () => {
  it("맞는 줄은 오류가 없다 (카테고리는 마스터에 있으면 필요 없어 비워도 된다)", () => {
    expect(check({})).toEqual({});
  });

  it("상품명·제조사: 비우면 필수, prodId 가 있으면 비워도 된다", () => {
    expect(check({ prodName: " ", prodBrand: "" })).toEqual({ prodName: v.required, prodBrand: v.required });
    expect(check({ prodId: "KP-2026-000001", prodName: "", prodBrand: "" })).toEqual({});
  });

  it("글자 수 상한: 상품명 50·제조사 40·분류번호 20·상품번호 20·카테고리 12·설명 200", () => {
    expect(check({ prodName: "a".repeat(51) }).prodName).toBe(v.prodName);
    expect(check({ prodName: "a".repeat(50) }).prodName).toBeUndefined();
    expect(check({ prodBrand: "a".repeat(41) }).prodBrand).toBe(v.prodBrand);
    expect(check({ prodClassNo: "a".repeat(21) }).prodClassNo).toBe(v.prodClassNo);
    expect(check({ prodNo: "a".repeat(21) }).prodNo).toBe(v.prodNo);
    expect(check({ categoryCode: "a".repeat(13) }).categoryCode).toBe(v.categoryCode);
    expect(check({ description: "a".repeat(201) }).description).toBe(v.description);
  });

  it("상품상태는 목록 값만", () => {
    expect(check({ prodState: "" }).prodState).toBe(v.prodState);
    expect(check({ prodState: "새것" }).prodState).toBe(v.prodState);
    expect(check({ prodState: "신품대비 50% 미만" }).prodState).toBeUndefined();
  });

  it("단가: 비움·글자·음수·10억 초과는 오류, 0·쉼표 숫자는 통과", () => {
    expect(check({ salesUnitPrice: "" }).salesUnitPrice).toBe(v.required);
    expect(check({ salesUnitPrice: "오백" }).salesUnitPrice).toBe(v.salesUnitPrice);
    expect(check({ salesUnitPrice: "-5" }).salesUnitPrice).toBe(v.salesUnitPrice);
    expect(check({ salesUnitPrice: "1000000001" }).salesUnitPrice).toBe(v.salesUnitPrice);
    expect(check({ salesUnitPrice: "0" }).salesUnitPrice).toBeUndefined();
    expect(check({ salesUnitPrice: "1,000" }).salesUnitPrice).toBeUndefined();
  });

  it("수량: 0·10만 초과·소수는 오류, 1과 100000 은 통과", () => {
    expect(check({ salesQuantity: "0" }).salesQuantity).toBe(v.salesQuantity);
    expect(check({ salesQuantity: "100001" }).salesQuantity).toBe(v.salesQuantity);
    expect(check({ salesQuantity: "1.5" }).salesQuantity).toBe(v.salesQuantity);
    expect(check({ salesQuantity: "1" }).salesQuantity).toBeUndefined();
    expect(check({ salesQuantity: "100000" }).salesQuantity).toBeUndefined();
  });

  it("최소주문량·주문단위는 비워도 되고, 있으면 1~100000. 최소주문량은 수량을 넘을 수 없다", () => {
    expect(check({ minOrderQuantity: "0" }).minOrderQuantity).toBe(v.minOrderQuantity);
    expect(check({ orderUnit: "0" }).orderUnit).toBe(v.orderUnit);
    expect(check({ minOrderQuantity: "4", salesQuantity: "3" }).minOrderQuantity).toBe(v.minOrderOverSales);
    expect(check({ minOrderQuantity: "3", salesQuantity: "3" }).minOrderQuantity).toBeUndefined();
  });

  it("제공가능일: 비움은 필수, 없는 날짜는 형식, 오늘 이전은 거절, 오늘은 통과", () => {
    expect(check({ deliveryDate: "" }).deliveryDate).toBe(v.required);
    expect(check({ deliveryDate: "2026-02-30" }).deliveryDate).toBe(v.date);
    expect(check({ deliveryDate: "2026-11-04" }).deliveryDate).toBe(v.deliveryDate);
    expect(check({ deliveryDate: TODAY }).deliveryDate).toBeUndefined();
  });
});

describe("isXlsx", () => {
  it(".xlsx 만 통과 (.xls·.csv 는 아님, 대소문자 무시)", () => {
    expect(isXlsx(new File([""], "a.xlsx"))).toBe(true);
    expect(isXlsx(new File([""], "A.XLSX"))).toBe(true);
    expect(isXlsx(new File([""], "a.xls"))).toBe(false);
    expect(isXlsx(new File([""], "a.csv"))).toBe(false);
  });
});
