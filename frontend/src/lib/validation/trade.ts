import { z } from "zod";
import { isValidDate } from "@/lib/search";
import { isInt, MAX_QUANTITY } from "@/lib/validation/listing";
import { trade } from "@/messages/trade";

// 구매 모달. 규칙은 서버 TradeService.validate 와 같다 (docs/security.md "입력 검증 > 구매").
// 재고는 서버가 최종 판정(409)하지만 화면에 보이는 재고로 먼저 막는다 (사용자 지시).
const v = trade.validation;

/** 거래이력 금액(trade_amount)이 int 라 서버가 넘는 주문을 거절한다 */
export const MAX_INT = 2_147_483_647;
export const MAX_REMARKS = 100;

export interface PurchaseLimits {
  stock: number;
  minOrder: number;
  unit: number;
  unitPrice: number;
  /** 한국 날짜 YYYY-MM-DD (lib/listingForm todayInSeoul) */
  today: string;
}

/**
 * 납품희망일 (구매·견적 같음, 서버 TradeService.reqDeliDateFailure): 필수(정의서 NOT NULL, 2026-10-27), 실제 날짜, 오늘 이후.
 * 화면 기본값은 매물 제공가능일 — 모달이 채운다
 */
export const reqDeliDateField = (today: string) =>
  z
    .string()
    .min(1, v.deliRequired)
    .superRefine((s, ctx) => {
      if (s === "") return;
      if (!isValidDate(s)) ctx.addIssue({ code: "custom", message: v.date });
      else if (s < today) ctx.addIssue({ code: "custom", message: v.deliPast });
    });

export const orderAmount = (unitPrice: number, quantity: number) => unitPrice * quantity;

/** 주문량 규칙(구매·견적 같음, 서버 TradeService.quantityFailure). 금액은 그 거래의 단가로. 맞으면 null */
export function quantityIssue(l: Pick<PurchaseLimits, "stock" | "minOrder" | "unit">, n: number, unitPrice: number): string | null {
  if (n < l.minOrder) return v.quantityMin(l.minOrder);
  if (n % l.unit !== 0) return v.quantityUnit(l.unit);
  if (n > l.stock || n > MAX_QUANTITY) return v.quantityStock(Math.min(l.stock, MAX_QUANTITY));
  if (orderAmount(unitPrice, n) > MAX_INT) return v.amountMax;
  return null;
}

export function purchaseSchema(l: PurchaseLimits) {
  return z.object({
    orderQuantity: z
      .string()
      .min(1, v.required)
      .refine((s) => isInt(s), v.quantityFormat)
      .transform(Number)
      .superRefine((n, ctx) => {
        const message = quantityIssue(l, n, l.unitPrice);
        if (message) ctx.addIssue({ code: "custom", message });
      }),
    reqDeliDate: reqDeliDateField(l.today),
    remarks: z
      .string()
      .trim()
      .max(MAX_REMARKS, v.remarksMax)
      .transform((s) => (s === "" ? undefined : s)),
  });
}

export type PurchaseFormInput = z.input<ReturnType<typeof purchaseSchema>>;
export type PurchaseFormOutput = z.output<ReturnType<typeof purchaseSchema>>;
