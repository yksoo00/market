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
    ["quote", "quoteAccepted", true, ["buy"]],
    ["quote", "quoteRejected", true, ["requote", "cancel"]],
    ["purchase", "requested", true, ["complete", "cancel"]],
    ["purchase", "confirmed", true, []],
    ["quote", "quoteRequested", false, ["accept", "reject"]],
    ["quote", "quoteAccepted", false, []],
    ["quote", "quoteRejected", false, []],
    ["purchase", "requested", false, ["cancel"]],
    ["purchase", "confirmed", false, []],
    // 수락된 견적에서 이어진 행 — 종류는 견적이어도 진행 상태가 구매요청이면 구매 줄과 같다
    ["quote", "requested", true, ["complete", "cancel"]],
    ["quote", "requested", false, ["cancel"]],
    ["quote", "confirmed", true, []],
  ] as const)("%s/%s 구매자=%s → %j", (type, stats, asBuyer, expected) => {
    expect(rowActions(row(type, stats), asBuyer)).toEqual(expected);
  });
});
