import { describe, expect, it } from "vitest";
import { trade } from "@/messages/trade";
import { MAX_INT, orderAmount, purchaseSchema, type PurchaseLimits } from "./trade";

const v = trade.validation;
const limits: PurchaseLimits = { stock: 100, minOrder: 4, unit: 2, unitPrice: 1000, provDate: "2026-10-30", today: "2026-10-16" };
const parse = (over: Partial<{ orderQuantity: string; reqDeliDate: string; remarks: string }>, l: PurchaseLimits = limits) =>
  purchaseSchema(l).safeParse({ orderQuantity: "4", reqDeliDate: "", remarks: "", ...over });
const errorOf = (r: ReturnType<typeof parse>, path: string) =>
  r.success ? undefined : r.error.issues.find((i) => i.path.join(".") === path)?.message;

describe("purchaseSchema", () => {
  it("규칙에 맞으면 숫자로 바꾸고 빈 납품희망일·요청사항은 빼서 서버 기본값을 쓴다", () => {
    const r = parse({ orderQuantity: "6" });
    expect(r.success).toBe(true);
    expect(r.success && r.data).toEqual({ orderQuantity: 6, reqDeliDate: undefined, remarks: undefined });
  });

  it("납품희망일 빈칸인데 매물 납기일이 지났으면 입력 요구, 오늘이면 통과", () => {
    expect(errorOf(parse({}, { ...limits, provDate: "2026-10-15" }), "reqDeliDate")).toBe(v.deliProvPast);
    expect(parse({}, { ...limits, provDate: "2026-10-16" }).success).toBe(true);
  });

  it("주문량: 비움·숫자 아님은 필수/형식 오류", () => {
    expect(errorOf(parse({ orderQuantity: "" }), "orderQuantity")).toBe(v.required);
    expect(errorOf(parse({ orderQuantity: "1.5" }), "orderQuantity")).toBe(v.quantityFormat);
  });

  it("주문량: 최소주문량 미만", () => {
    expect(errorOf(parse({ orderQuantity: "2" }), "orderQuantity")).toBe(v.quantityMin(4));
  });

  it("주문량: 주문단위 배수 아님", () => {
    expect(errorOf(parse({ orderQuantity: "5" }), "orderQuantity")).toBe(v.quantityUnit(2));
  });

  it("주문량: 현재 재고 초과", () => {
    expect(errorOf(parse({ orderQuantity: "102" }), "orderQuantity")).toBe(v.quantityStock(100));
  });

  it("금액(단가 × 수량)이 int 범위를 넘으면 오류", () => {
    const r = parse({ orderQuantity: "3" }, { ...limits, minOrder: 1, unit: 1, unitPrice: 1_000_000_000 });
    expect(errorOf(r, "orderQuantity")).toBe(v.amountMax);
  });

  it("납품희망일: 매물 납기일이 없으면 필수", () => {
    expect(errorOf(parse({}, { ...limits, provDate: null }), "reqDeliDate")).toBe(v.deliRequired);
  });

  it("납품희망일: 없는 날짜·오늘 이전은 오류, 오늘은 통과", () => {
    expect(errorOf(parse({ reqDeliDate: "2026-02-30" }), "reqDeliDate")).toBe(v.date);
    expect(errorOf(parse({ reqDeliDate: "2026-10-15" }), "reqDeliDate")).toBe(v.deliPast);
    expect(parse({ reqDeliDate: "2026-10-16" }).success).toBe(true);
  });

  it("요청사항 100자 초과는 오류, 앞뒤 공백은 자른다", () => {
    expect(errorOf(parse({ remarks: "가".repeat(101) }), "remarks")).toBe(v.remarksMax);
    const r = parse({ remarks: "  빨리  " });
    expect(r.success && r.data.remarks).toBe("빨리");
  });
});

describe("orderAmount", () => {
  it("단가 × 수량", () => {
    expect(orderAmount(1000, 4)).toBe(4000);
    expect(MAX_INT).toBe(2_147_483_647);
  });
});
