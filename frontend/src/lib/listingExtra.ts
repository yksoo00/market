import { listing } from "@/messages/listing";
import type { ListingDetail, ListingUpdateRequest } from "@/types/listing";

/** 보증기간 드롭다운(개월). 0 = 없음. 서버가 받는 일수 목록(0·30·90·180·360·720·1080)과 같다 */
export const WARRANTY_MONTHS = [0, 1, 3, 6, 12, 24, 36] as const;

/** 불량지원 드롭다운 값. "" = 없음 */
export const WARRANTY_COVERAGES = ["", "대체", "환불"] as const;

const DAYS_PER_MONTH = 30;

export const monthsToDays = (months: number): number => months * DAYS_PER_MONTH;

/** 저장된 일수 → 가장 가까운 드롭다운 개월. null 은 0, 동률이면 작은 쪽. 옛 값(365일)은 12개월로 보인다 */
export function daysToMonths(days: number | null): number {
  if (days === null) return 0;
  let best: number = WARRANTY_MONTHS[0];
  for (const m of WARRANTY_MONTHS) {
    if (Math.abs(monthsToDays(m) - days) < Math.abs(monthsToDays(best) - days)) best = m;
  }
  return best;
}

/** 추가등록 폼 값. 파일 칸은 업로드 키("" = 없음) */
export interface ExtraValues {
  warrantyMonths: number;
  warrantyCoverage: string;
  replaceProd: string;
  testReport: string;
  certificateOfAuthen: string;
}

export function extraInitialValues(d: ListingDetail): ExtraValues {
  return {
    warrantyMonths: daysToMonths(d.warrantyPeriod),
    warrantyCoverage: d.warrantyCoverage ?? "",
    replaceProd: d.replaceProd ?? "",
    testReport: d.testReport ?? "",
    certificateOfAuthen: d.certificateOfAuthen ?? "",
  };
}

const textFields = ["warrantyCoverage", "replaceProd", "testReport", "certificateOfAuthen"] as const;

/**
 * 처음 값과 달라진 칸만 PATCH 로. 보증은 "개월"이 바뀌었을 때만 일수로 보낸다 — 옛 값(365일)이 12개월로 보여도
 * 사용자가 안 건드렸으면 서버 값(365)을 그대로 두어 허용 목록 검증에 걸리지 않게. 지운 칸은 ""(비우기).
 */
export function diffToExtraRequest(initial: ExtraValues, current: ExtraValues): ListingUpdateRequest {
  const req: ListingUpdateRequest = {};
  if (initial.warrantyMonths !== current.warrantyMonths) req.warrantyPeriod = monthsToDays(current.warrantyMonths);
  for (const key of textFields) {
    if (initial[key] !== current[key]) req[key] = current[key];
  }
  return req;
}

export const extraFilledLabel = (n: number): string => listing.extra.filled(n);
