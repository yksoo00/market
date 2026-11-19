import { z } from "zod";
import { isInt, MAX_QUANTITY } from "@/lib/validation/listing";
import { MAX_REMARKS, quantityIssue, reqDeliDateField } from "@/lib/validation/trade";
import { trade } from "@/messages/trade";

// 장바구니 담기 모달. 규칙은 서버 CartService.add 와 같다 (docs/security.md "입력 검증 > 장바구니").
// 구매와 같은 주문량·납품희망일·요청사항 규칙이고, 담으면 그 수량이 재고에서 묶이므로 재고도 본다 (2026-11-02 — 전엔 재고를 안 봤다).
const v = trade.validation;

export { MAX_CART_ADD } from "@/lib/validation/cart";

/** 줄마다 매물 값 — 상세에서 읽는다 */
export interface CartAddLimits {
  /** 지금 재고 — 담는 수량이 이보다 많으면 막는다 (서버가 최종 판정) */
  stock: number;
  minOrder: number;
  unit: number;
  /** 등록단가 — 금액 한도 확인용 (담을 때 단가는 등록단가로 고정) */
  unitPrice: number;
  /** 한국 날짜 YYYY-MM-DD — 납품희망일 기준 */
  today: string;
}

function rowSchema(l: CartAddLimits) {
  return z.object({
    orderQuantity: z
      .string()
      .min(1, v.required)
      .refine((s) => isInt(s), v.quantityFormat)
      .transform(Number)
      .superRefine((n, ctx) => {
        const message = quantityIssue({ stock: Math.min(l.stock, MAX_QUANTITY), minOrder: l.minOrder, unit: l.unit }, n, l.unitPrice);
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

/** limits[i] 가 items[i] 의 규칙. 오류 경로는 items.i.칸 (서버 fields 키 items[i].칸 과 짝) — 견적 모달과 같은 방식 */
export function cartAddSchema(limits: CartAddLimits[]): z.ZodType<CartAddFormOutput, CartAddFormInput> {
  const rows = limits.map(rowSchema);
  return z.object({ items: z.tuple(rows as [ReturnType<typeof rowSchema>, ...ReturnType<typeof rowSchema>[]]) }) as unknown as z.ZodType<
    CartAddFormOutput,
    CartAddFormInput
  >;
}

export type CartAddRowInput = z.input<ReturnType<typeof rowSchema>>;
export type CartAddFormInput = { items: CartAddRowInput[] };
export type CartAddFormOutput = { items: z.output<ReturnType<typeof rowSchema>>[] };
