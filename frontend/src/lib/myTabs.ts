// 내 활동내역·내 거래이력의 탭 값. 주소의 ?tab= 이 원본이고, 모르는 값은 기본 탭으로 본다 (손으로 고친 주소)

export const ACTIVITY_TABS = ["requests", "sales", "purchases"] as const;
export type ActivityTab = (typeof ACTIVITY_TABS)[number];

export const HISTORY_TABS = ["all", "buy", "sell"] as const;
export type HistoryTab = (typeof HISTORY_TABS)[number];

const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));

export function parseActivityTab(raw: string | string[] | undefined): ActivityTab {
  const value = first(raw);
  return ACTIVITY_TABS.find((t) => t === value) ?? "requests";
}

export function parseHistoryTab(raw: string | string[] | undefined): HistoryTab {
  const value = first(raw);
  return HISTORY_TABS.find((t) => t === value) ?? "all";
}

/** 요청 탭을 그 매물(regDate 14자리)로 거르는 값. 형식이 틀리면 거르지 않는다 */
export function parseReg(raw: string | string[] | undefined): string | undefined {
  const value = first(raw);
  return /^\d{14}$/.test(value) ? value : undefined;
}
