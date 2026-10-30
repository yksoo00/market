import { z } from "zod";
import { HISTORY_SORTS, isRealDate, MAX_AMOUNT, MAX_Q, SEARCH_FIELDS } from "@/lib/historyFilter";
import { my } from "@/messages/my";

const t = my.history.filter.validation;

const amount = z.string().refine((s) => s === "" || (/^\d{1,10}$/.test(s) && Number(s) <= MAX_AMOUNT), t.amount);
const date = z.string().refine((s) => s === "" || isRealDate(s), t.date);

/**
 * 목록 검색·필터 폼 검증. statuses = 고를 수 있는 거래상태 값(없으면 상태 칸 없음 — 거래이력). 빈 문자열 = 상태 전체.
 * 칸은 문자열 그대로(빈 칸 = 조건 없음) — 폼 값이 곧 주소 값. 수치는 docs/security.md "입력 검증" 거래이력·활동내역.
 * zod 4는 칸 검사가 실패해도 뒤 refine 을 돌리므로 형식이 맞을 때만 앞뒤를 비교한다
 */
export function listFilterSchema(statuses: readonly string[] | null) {
  return z
    .object({
      q: z.string().refine((s) => s.trim().length <= MAX_Q, t.q),
      field: z.enum(SEARCH_FIELDS),
      from: date,
      to: date,
      min: amount,
      max: amount,
      sort: z.enum(HISTORY_SORTS),
      ...(statuses ? { status: z.string().refine((s) => s === "" || statuses.includes(s)) } : {}),
    })
    .refine((v) => !(isRealDate(v.from) && isRealDate(v.to)) || v.from <= v.to, { message: t.dateOrder, path: ["to"] })
    .refine((v) => !(/^\d{1,10}$/.test(v.min) && /^\d{1,10}$/.test(v.max)) || Number(v.min) <= Number(v.max), {
      message: t.amountOrder,
      path: ["max"],
    });
}

/** 내 거래이력: 상태 칸 없음 */
export const historyFilterSchema = listFilterSchema(null);

export type HistoryFilterInput = z.input<typeof historyFilterSchema>;
