import { describe, expect, it } from "vitest";
import { cartAddSchema, MAX_CART_ADD, type CartAddLimits } from "./cartAdd";

const today = "2026-10-29";
const limits = (over: Partial<CartAddLimits> = {}): CartAddLimits => ({ stock: 100_000, minOrder: 2, unit: 2, unitPrice: 1000, today, ...over });
const parse = (rows: object[], ls: CartAddLimits[] = rows.map(() => limits())) =>
  cartAddSchema(ls).safeParse({ items: rows });
const row = (over: object = {}) => ({ orderQuantity: "4", reqDeliDate: "2026-11-01", remarks: "", ...over });
const paths = (rows: object[], ls?: CartAddLimits[]) => {
  const r = parse(rows, ls);
  return r.success ? [] : [...new Set(r.error.issues.map((i) => i.path.join(".")))];
};

describe("cartAddSchema", () => {
  it("정상 입력은 통과하고 빈 요청사항은 생략된다", () => {
    const r = parse([row()]);
    expect(r.success).toBe(true);
    expect(r.data?.items[0]).toEqual({ orderQuantity: 4, reqDeliDate: "2026-11-01", remarks: undefined });
  });

  it("주문량: 최소주문량 미만·주문단위 아님·숫자 아님·비어 있음은 오류", () => {
    expect(paths([row({ orderQuantity: "1" })])).toEqual(["items.0.orderQuantity"]);
    expect(paths([row({ orderQuantity: "5" })])).toEqual(["items.0.orderQuantity"]);
    expect(paths([row({ orderQuantity: "4.5" })])).toEqual(["items.0.orderQuantity"]);
    expect(paths([row({ orderQuantity: "" })])).toEqual(["items.0.orderQuantity"]);
  });

  it("금액(등록단가 × 수량)이 int 를 넘으면 오류", () => {
    expect(paths([row({ orderQuantity: "100000" })], [limits({ minOrder: 1, unit: 1, unitPrice: 1_000_000_000 })])).toEqual([
      "items.0.orderQuantity",
    ]);
  });

  it("담으면 재고에서 묶이므로 재고보다 많이 담을 수 없다 (2026-11-02) — 재고와 같으면 통과", () => {
    const at = (stock: number) => [limits({ stock, minOrder: 1, unit: 1, unitPrice: 1 })];
    expect(paths([row({ orderQuantity: "11" })], at(10))).toEqual(["items.0.orderQuantity"]);
    expect(paths([row({ orderQuantity: "10" })], at(10))).toEqual([]);
    expect(paths([row({ orderQuantity: "1" })], at(0))).toEqual(["items.0.orderQuantity"]);
  });

  it("납품희망일: 비어 있음·없는 날짜·지난 날짜는 오류, 오늘은 통과", () => {
    expect(paths([row({ reqDeliDate: "" })])).toEqual(["items.0.reqDeliDate"]);
    expect(paths([row({ reqDeliDate: "2026-02-31" })])).toEqual(["items.0.reqDeliDate"]);
    expect(paths([row({ reqDeliDate: "2026-10-28" })])).toEqual(["items.0.reqDeliDate"]);
    expect(paths([row({ reqDeliDate: today })])).toEqual([]);
  });

  it("요청사항은 100자까지", () => {
    expect(paths([row({ remarks: "가".repeat(101) })])).toEqual(["items.0.remarks"]);
    expect(paths([row({ remarks: "가".repeat(100) })])).toEqual([]);
  });

  it("줄마다 자기 매물의 규칙으로 본다", () => {
    expect(paths([row({ orderQuantity: "3" }), row({ orderQuantity: "3" })], [limits({ minOrder: 1, unit: 1 }), limits()])).toEqual([
      "items.1.orderQuantity",
    ]);
  });

  it("한 번에 20개 (서버 CartAddRequest.MAX_ADD)", () => {
    expect(MAX_CART_ADD).toBe(20);
  });
});
