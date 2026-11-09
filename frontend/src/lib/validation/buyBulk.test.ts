import { describe, expect, it } from "vitest";
import { buyBulk } from "@/messages/buyBulk";
import { validateBuyRow, type BuyFields } from "./buyBulk";

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
};
const check = (patch: Partial<BuyFields>) => validateBuyRow({ ...ok, ...patch }, TODAY);

describe("validateBuyRow", () => {
  it("맞는 줄은 오류가 없다", () => {
    expect(check({})).toEqual({});
  });

  it("상품명·제조사: 비우면 필수, 상품 ID 가 있으면 비워도 된다", () => {
    expect(check({ prodName: " ", prodBrand: "" })).toEqual({ prodName: v.required, prodBrand: v.required });
    expect(check({ prodId: "KP-2026-000001", prodName: "", prodBrand: "" })).toEqual({});
  });

  it("글자 수 상한: 상품명 50 · 제조사 40 · 분류번호 20 · 요청사항 100", () => {
    expect(check({ prodName: "a".repeat(51) }).prodName).toBe(v.prodName);
    expect(check({ prodName: "a".repeat(50) }).prodName).toBeUndefined();
    expect(check({ prodBrand: "a".repeat(41) }).prodBrand).toBe(v.prodBrand);
    expect(check({ prodClassNo: "a".repeat(21) }).prodClassNo).toBe(v.prodClassNo);
    expect(check({ remarks: "a".repeat(101) }).remarks).toBe(v.remarks);
    expect(check({ remarks: "a".repeat(100) }).remarks).toBeUndefined();
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

  it("납품희망일: 비움은 필수, 없는 날짜는 형식, 오늘 이전은 거절, 오늘은 통과", () => {
    expect(check({ reqDeliDate: "" }).reqDeliDate).toBe(v.required);
    expect(check({ reqDeliDate: "2026-02-30" }).reqDeliDate).toBe(v.date);
    expect(check({ reqDeliDate: "2026-11-08" }).reqDeliDate).toBe(v.reqDeliDate);
    expect(check({ reqDeliDate: TODAY }).reqDeliDate).toBeUndefined();
  });
});
