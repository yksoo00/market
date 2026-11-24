import { describe, expect, it } from "vitest";
import { buyBulk } from "@/messages/buyBulk";
import { BUY_INPUT_FIELDS, conditionCount, validateBuyRow, type BuyFields } from "./buyBulk";

const v = buyBulk.validation;
const TODAY = "2026-11-09";
const ok: BuyFields = {
  prodId: "",
  prodName: "스위치 C9300",
  prodBrand: "Cisco",
  prodClassNo: "",
  orderQuantity: "3",
  reqDeliDate: "2026-12-01",
  remarks: "",
  sellerId: "",
  regDate: "",
  minState: "",
  maxPrice: "",
  minWarrantyMonths: "",
  needDataSheet: "",
  needPhoto: "",
  needCoverage: "",
  needTestReport: "",
  needCertificate: "",
};
const check = (patch: Partial<BuyFields>) => validateBuyRow({ ...ok, ...patch }, TODAY);

describe("validateBuyRow", () => {
  it("맞는 줄은 오류가 없다", () => {
    expect(check({})).toEqual({});
  });

  it("상품명: 비우면 필수, 상품 ID 가 있으면 비워도 된다. 제조사는 비워도 된다 (이름만으로 찾는다)", () => {
    expect(check({ prodName: " ", prodBrand: "" })).toEqual({ prodName: v.required });
    expect(check({ prodId: "KP-2026-000001", prodName: "", prodBrand: "" })).toEqual({});
    expect(check({ prodBrand: "" })).toEqual({});
  });

  it("글자 수 상한: 상품명 50 · 제조사 40 · 분류번호 20 · 요청사항 100", () => {
    expect(check({ prodName: "a".repeat(51) }).prodName).toBe(v.prodName);
    expect(check({ prodName: "a".repeat(50) }).prodName).toBeUndefined();
    expect(check({ prodBrand: "a".repeat(41) }).prodBrand).toBe(v.prodBrand);
    expect(check({ prodClassNo: "a".repeat(21) }).prodClassNo).toBe(v.prodClassNo);
    expect(check({ remarks: "a".repeat(101) }).remarks).toBe(v.remarks);
    expect(check({ remarks: "a".repeat(100) }).remarks).toBeUndefined();
  });

  it("입력 칸에 구매자가 모르는 분류번호는 없다 (마스터를 고르면 내부 값으로만 채워진다)", () => {
    expect(BUY_INPUT_FIELDS).toEqual(["prodName", "prodBrand", "orderQuantity", "reqDeliDate", "remarks"]);
  });

  it("수량: 비움·글자·0·소수·10만 초과는 오류, 1·100000·쉼표 숫자는 통과", () => {
    expect(check({ orderQuantity: "" }).orderQuantity).toBe(v.required);
    expect(check({ orderQuantity: "세개" }).orderQuantity).toBe(v.orderQuantity);
    expect(check({ orderQuantity: "0" }).orderQuantity).toBe(v.orderQuantity);
    expect(check({ orderQuantity: "1.5" }).orderQuantity).toBe(v.orderQuantity);
    expect(check({ orderQuantity: "100001" }).orderQuantity).toBe(v.orderQuantity);
    expect(check({ orderQuantity: "1" }).orderQuantity).toBeUndefined();
    expect(check({ orderQuantity: "100000" }).orderQuantity).toBeUndefined();
    expect(check({ orderQuantity: "1,000" }).orderQuantity).toBeUndefined();
  });

  it("조건 칸: 비움은 조건 없음, 상태는 목록 안, 단가는 1~10억, 보증은 1·3·6·12·24·36, 증빙은 Y(대소문자 무시)만", () => {
    expect(check({})).toEqual({});
    expect(check({ minState: "신품대비 80~89%" }).minState).toBeUndefined();
    expect(check({ minState: "양호" }).minState).toBe(v.minState);

    expect(check({ maxPrice: "1,500,000" }).maxPrice).toBeUndefined();
    expect(check({ maxPrice: "1000000000" }).maxPrice).toBeUndefined();
    expect(check({ maxPrice: "0" }).maxPrice).toBe(v.maxPrice);
    expect(check({ maxPrice: "1000000001" }).maxPrice).toBe(v.maxPrice);
    expect(check({ maxPrice: "싸게" }).maxPrice).toBe(v.maxPrice);

    for (const m of ["1", "3", "6", "12", "24", "36"]) expect(check({ minWarrantyMonths: m }).minWarrantyMonths).toBeUndefined();
    for (const m of ["0", "5", "37", "육개월"]) expect(check({ minWarrantyMonths: m }).minWarrantyMonths).toBe(v.minWarrantyMonths);

    expect(check({ needDataSheet: "Y", needPhoto: "y" })).toEqual({});
    expect(check({ needCoverage: "예" }).needCoverage).toBe(v.need);
  });

  it("조건 개수: 값이 있는 조건 칸만 센다", () => {
    expect(conditionCount(ok)).toBe(0);
    expect(conditionCount({ ...ok, minState: "신품", needPhoto: "Y", maxPrice: " " })).toBe(2);
  });

  it("납품희망일: 비움은 필수, 없는 날짜는 형식, 오늘 이전은 거절, 오늘은 통과", () => {
    expect(check({ reqDeliDate: "" }).reqDeliDate).toBe(v.required);
    expect(check({ reqDeliDate: "2026-02-30" }).reqDeliDate).toBe(v.date);
    expect(check({ reqDeliDate: "2026-11-08" }).reqDeliDate).toBe(v.reqDeliDate);
    expect(check({ reqDeliDate: TODAY }).reqDeliDate).toBeUndefined();
  });
});
