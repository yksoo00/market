import { describe, expect, it } from "vitest";
import type { Trade, TradeStats, TradeType } from "@/types/trade";
import { rowActions } from "./tradeActions";

const row = (tradeType: TradeType, tradeStats: TradeStats): Trade => ({
  tradeId: "26102010001",
  tradeType,
  tradeStats,
  sellerId: "s",
  regDate: "20261020100000",
  prodName: "서버",
  orderQuantity: 1,
  salesUnitPrice: 1000,
  orderUnitPrice: 900,
  amount: 900,
  reqDeliDate: null,
  remarks: null,
  counterpartNickname: null,
  photo: null,
});

describe("rowActions", () => {
  it.each([
    ["quote", "quoteRequested", true, ["cancel"]],
    ["quote", "quoteReplied", true, ["buy"]],
    ["purchase", "requested", true, ["complete", "cancel"]],
    ["purchase", "confirmed", true, []],
    ["quote", "quoteRequested", false, ["accept", "reject"]],
    ["quote", "quoteReplied", false, []],
    ["purchase", "requested", false, ["cancel"]],
    ["purchase", "confirmed", false, []],
  ] as const)("%s/%s 구매자=%s → %j", (type, stats, asBuyer, expected) => {
    expect(rowActions(row(type, stats), asBuyer)).toEqual(expected);
  });
});
