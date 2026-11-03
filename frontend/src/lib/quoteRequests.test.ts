import { describe, expect, it } from "vitest";
import { groupQuoteRequests, isHandledCode, overStock, quantitySum } from "@/lib/quoteRequests";
import type { QuoteRequestItem } from "@/types/trade";

const item = (tradeId: string, regDate: string, orderQuantity: number, stockQuantity: number | null = 10): QuoteRequestItem => ({
  tradeId,
  regDate,
  prodName: `상품 ${regDate}`,
  buyerNickname: "구매자",
  orderQuantity,
  salesUnitPrice: 1000,
  orderUnitPrice: 900,
  amount: 900 * orderQuantity,
  reqDeliDate: "2099-12-31",
  remarks: null,
  stockQuantity,
});

describe("groupQuoteRequests", () => {
  it("같은 매물끼리 묶고 묶음·줄의 받은 순서를 지킨다", () => {
    const groups = groupQuoteRequests([item("1", "A", 6), item("2", "B", 2), item("3", "A", 4)]);
    expect(groups.map((g) => g.regDate)).toEqual(["A", "B"]);
    expect(groups[0].items.map((i) => i.tradeId)).toEqual(["1", "3"]);
    expect(groups[0].stock).toBe(10);
    expect(groups[0].prodName).toBe("상품 A");
  });

  it("빈 목록은 묶음이 없다", () => {
    expect(groupQuoteRequests([])).toEqual([]);
  });
});

describe("quantitySum · overStock", () => {
  it("합계를 구하고, 재고를 넘을 때만 넘은 것으로 본다", () => {
    expect(quantitySum([item("1", "A", 6), item("2", "A", 4)])).toBe(10);
    expect(overStock(10, 10)).toBe(false);
    expect(overStock(10, 12)).toBe(true);
  });

  it("재고를 모르면 서버가 판정하게 넘지 않은 것으로 본다", () => {
    expect(overStock(null, 99)).toBe(false);
  });
});

describe("isHandledCode", () => {
  it("이미 처리됐거나 없어진 견적만 목록에서 뺀다", () => {
    expect(isHandledCode("TRADE_NOT_PENDING")).toBe(true);
    expect(isHandledCode("TRADE_NOT_FOUND")).toBe(true);
    expect(isHandledCode("TRADE_OUT_OF_STOCK")).toBe(false);
    expect(isHandledCode(null)).toBe(false);
  });
});
