import { z } from "zod";
import { isInt } from "@/lib/validation/listing";
import { MAX_REMARKS, quantityIssue } from "@/lib/validation/trade";
import { trade } from "@/messages/trade";

// 견적 모달. 규칙은 서버 TradeService.requestQuotes 와 같다 (docs/security.md "입력 검증 > 견적")
const v = trade.validation;
const q = trade.quote.validation;

/** 한 번에 보낼 수 있는 매물 수 (서버 QuoteCreateRequest.MAX_ITEMS) */
export const MAX_QUOTE_ITEMS = 20;

/** 줄마다 매물 값 — 상세에서 읽는다 */
export interface QuoteLimits {
  stock: number;
  minOrder: number;
  unit: number;
  /** 등록단가 = 희망단가 상한 */
  listedPrice: number;
}

/** 한 줄 = 한 매물의 규칙 */
function rowSchema(l: QuoteLimits) {
  return z
    .object({
      orderUnitPrice: z
        .string()
        .min(1, q.priceRequired)
        .refine((s) => isInt(s), q.priceFormat)
        .transform(Number)
        .refine((n) => n >= 1 && n <= l.listedPrice, q.priceRange(l.listedPrice)),
      orderQuantity: z.string().min(1, v.required).refine((s) => isInt(s), v.quantityFormat).transform(Number),
      remarks: z
        .string()
        .trim()
        .max(MAX_REMARKS, q.remarksMax)
        .transform((s) => (s === "" ? undefined : s)),
    })
    .superRefine((row, ctx) => {
      // 금액은 희망단가로 본다 — 단가가 정해진 뒤라 객체에서
      const quantity = quantityIssue(l, row.orderQuantity, row.orderUnitPrice);
      if (quantity) ctx.addIssue({ code: "custom", path: ["orderQuantity"], message: quantity });
    });
}

/**
 * limits[i] 가 items[i] 의 규칙 — 줄마다 매물이 달라 배열 대신 길이가 정해진 tuple 로 만든다.
 * 오류 경로는 items.i.칸 (서버 fields 키 items[i].칸 과 짝)
 */
export function quoteSchema(limits: QuoteLimits[]): z.ZodType<QuoteFormOutput, QuoteFormInput> {
  const rows = limits.map(rowSchema);
  // tuple 은 줄 수가 정해져 있어 타입이 줄마다 펼쳐진다 — 폼이 쓰는 배열 타입으로 맞춘다
  return z.object({ items: z.tuple(rows as [ReturnType<typeof rowSchema>, ...ReturnType<typeof rowSchema>[]]) }) as unknown as z.ZodType<
    QuoteFormOutput,
    QuoteFormInput
  >;
}

export type QuoteRowInput = z.input<ReturnType<typeof rowSchema>>;
export type QuoteFormInput = { items: QuoteRowInput[] };
export type QuoteFormOutput = { items: z.output<ReturnType<typeof rowSchema>>[] };
