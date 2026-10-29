import { z } from "zod";
import { isInt, MAX_QUANTITY } from "@/lib/validation/listing";
import { MAX_REMARKS, quantityIssue, reqDeliDateField } from "@/lib/validation/trade";
import { trade } from "@/messages/trade";

// 장바구니 담기 모달. 규칙은 서버 CartService.add 와 같다 (docs/security.md "입력 검증 > 장바구니").
// 구매와 같은 주문량·납품희망일·요청사항 규칙이고, 재고는 보지 않는다 — 재고가 모자라도 담아 두고 구매 때 다시 본다.
const v = trade.validation;

export { MAX_CART_ADD } from "@/lib/validation/cart";

/** 줄마다 매물 값 — 상세에서 읽는다 */
export interface CartAddLimits {
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
        // 재고 대신 한 번에 담을 수 있는 최대 수량(MAX_QUANTITY)을 상한으로 쓴다
        const message = quantityIssue({ stock: MAX_QUANTITY, minOrder: l.minOrder, unit: l.unit }, n, l.unitPrice);
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
