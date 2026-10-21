import { describe, expect, it } from "vitest";
import { trade } from "@/messages/trade";
import { quoteSchema, type QuoteLimits } from "./quote";

const v = trade.validation;
const q = trade.quote.validation;
const limits: QuoteLimits = { stock: 10, minOrder: 2, unit: 2, listedPrice: 1000 };
const parse = (row: Partial<{ orderUnitPrice: string; orderQuantity: string; remarks: string }>, l: QuoteLimits = limits) =>
  quoteSchema([l]).safeParse({ items: [{ orderUnitPrice: "900", orderQuantity: "2", remarks: "", ...row }] });
const errorOf = (r: ReturnType<typeof parse>, field: string) =>
  r.success ? undefined : r.error.issues.find((i) => i.path.join(".") === `items.0.${field}`)?.message;

describe("quoteSchema", () => {
  it("맞으면 숫자로 바꾸고 빈 비고는 뺀다", () => {
    const r = parse({});
    expect(r.success && r.data).toEqual({ items: [{ orderUnitPrice: 900, orderQuantity: 2, remarks: undefined }] });
  });

  it("희망단가: 비움·숫자 아님·0·등록단가 초과는 오류, 등록단가와 같으면 통과", () => {
    expect(errorOf(parse({ orderUnitPrice: "" }), "orderUnitPrice")).toBe(q.priceRequired);
    expect(errorOf(parse({ orderUnitPrice: "9.5" }), "orderUnitPrice")).toBe(q.priceFormat);
    expect(errorOf(parse({ orderUnitPrice: "0" }), "orderUnitPrice")).toBe(q.priceRange(1000));
    expect(errorOf(parse({ orderUnitPrice: "1001" }), "orderUnitPrice")).toBe(q.priceRange(1000));
    expect(parse({ orderUnitPrice: "1000" }).success).toBe(true);
  });

  it("수량: 구매와 같은 규칙 (최소주문량·주문단위·재고)", () => {
    expect(errorOf(parse({ orderQuantity: "" }), "orderQuantity")).toBe(v.required);
    expect(errorOf(parse({ orderQuantity: "1" }), "orderQuantity")).toBe(v.quantityMin(2));
    expect(errorOf(parse({ orderQuantity: "3" }), "orderQuantity")).toBe(v.quantityUnit(2));
    expect(errorOf(parse({ orderQuantity: "12" }), "orderQuantity")).toBe(v.quantityStock(10));
  });

  it("금액은 희망단가로 본다 — 희망단가 × 수량이 int 를 넘으면 오류", () => {
    const big: QuoteLimits = { stock: 100_000, minOrder: 1, unit: 1, listedPrice: 1_000_000_000 };
    expect(errorOf(parse({ orderUnitPrice: "1000000000", orderQuantity: "3" }, big), "orderQuantity")).toBe(v.amountMax);
    expect(parse({ orderUnitPrice: "1", orderQuantity: "3" }, big).success).toBe(true);
  });

  it("줄마다 그 매물의 규칙을 쓴다 — 두 번째 줄 등록단가 500", () => {
    const r = quoteSchema([limits, { ...limits, listedPrice: 500 }]).safeParse({
      items: [
        { orderUnitPrice: "900", orderQuantity: "2", remarks: "" },
        { orderUnitPrice: "900", orderQuantity: "2", remarks: "" },
      ],
    });
    const issues = r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}:${i.message}`);
    expect(issues).toEqual([`items.1.orderUnitPrice:${q.priceRange(500)}`]);
  });

  it("비고 100자 초과는 오류", () => {
    expect(errorOf(parse({ remarks: "가".repeat(101) }), "remarks")).toBe(q.remarksMax);
  });
});
