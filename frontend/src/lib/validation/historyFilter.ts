import { z } from "zod";
import { HISTORY_SORTS, isRealDate, MAX_AMOUNT, MAX_Q } from "@/lib/historyFilter";
import { my } from "@/messages/my";

const t = my.history.filter.validation;

const amount = z.string().refine((s) => s === "" || (/^\d{1,10}$/.test(s) && Number(s) <= MAX_AMOUNT), t.amount);
const date = z.string().refine((s) => s === "" || isRealDate(s), t.date);

// 칸은 문자열 그대로 (빈 칸 = 조건 없음) — 폼 값이 곧 주소 값. 수치는 docs/security.md "입력 검증" 거래이력.
// zod 4는 칸 검사가 실패해도 이 refine 을 돌리므로 형식이 맞을 때만 앞뒤를 비교한다
export const historyFilterSchema = z
  .object({
    q: z.string().refine((s) => s.trim().length <= MAX_Q, t.q),
    from: date,
    to: date,
    min: amount,
    max: amount,
    sort: z.enum(HISTORY_SORTS),
  })
  .refine((v) => !(isRealDate(v.from) && isRealDate(v.to)) || v.from <= v.to, { message: t.dateOrder, path: ["to"] })
  .refine((v) => !(/^\d{1,10}$/.test(v.min) && /^\d{1,10}$/.test(v.max)) || Number(v.min) <= Number(v.max), {
    message: t.amountOrder,
    path: ["max"],
  });

export type HistoryFilterInput = z.input<typeof historyFilterSchema>;
