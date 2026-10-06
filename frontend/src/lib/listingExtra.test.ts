import { describe, expect, it } from "vitest";
import {
  daysToMonths,
  diffToExtraRequest,
  extraFilledLabel,
  extraInitialValues,
  monthsToDays,
  WARRANTY_MONTHS,
  type ExtraValues,
} from "./listingExtra";
import type { ListingDetail } from "@/types/listing";

const detail = {
  warrantyPeriod: null,
  warrantyCoverage: null,
  replaceProd: null,
  testReport: null,
  certificateOfAuthen: null,
} as ListingDetail;

describe("보증 개월 ↔ 일수", () => {
  it("개월 × 30 일 (12개월 = 360일)", () => {
    expect(WARRANTY_MONTHS).toEqual([0, 1, 3, 6, 12, 24, 36]);
    expect(monthsToDays(0)).toBe(0);
    expect(monthsToDays(12)).toBe(360);
    expect(monthsToDays(36)).toBe(1080);
  });

  it("일수 → 가장 가까운 개월 (null 은 0, 동률이면 작은 쪽)", () => {
    expect(daysToMonths(null)).toBe(0);
    expect(daysToMonths(90)).toBe(3);
    expect(daysToMonths(360)).toBe(12);
    expect(daysToMonths(365)).toBe(12);
    expect(daysToMonths(1080)).toBe(36);
    expect(daysToMonths(45)).toBe(1);
    expect(daysToMonths(60)).toBe(1);
  });
});

describe("extraInitialValues", () => {
  it("비어 있으면 없음·빈 키", () => {
    expect(extraInitialValues(detail)).toEqual({
      warrantyMonths: 0,
      warrantyCoverage: "",
      replaceProd: "",
      testReport: "",
      certificateOfAuthen: "",
    });
  });

  it("채워져 있으면 그대로(옛 365일은 12개월로 보임)", () => {
    const d = { ...detail, warrantyPeriod: 365, warrantyCoverage: "대체", testReport: "k.pdf" } as ListingDetail;
    expect(extraInitialValues(d)).toMatchObject({ warrantyMonths: 12, warrantyCoverage: "대체", testReport: "k.pdf" });
  });
});

describe("diffToExtraRequest", () => {
  const initial: ExtraValues = {
    warrantyMonths: 12,
    warrantyCoverage: "대체",
    replaceProd: "",
    testReport: "t.pdf",
    certificateOfAuthen: "c.pdf",
  };

  it("아무것도 안 바꾸면 빈 객체 — 옛 365일도 개월 그대로면 다시 보내지 않는다", () => {
    expect(diffToExtraRequest(initial, { ...initial })).toEqual({});
  });

  it("보증을 바꾸면 개월 × 30 일", () => {
    expect(diffToExtraRequest(initial, { ...initial, warrantyMonths: 24 })).toEqual({ warrantyPeriod: 720 });
    expect(diffToExtraRequest(initial, { ...initial, warrantyMonths: 0 })).toEqual({ warrantyPeriod: 0 });
  });

  it("불량지원을 없음으로 바꾸면 빈 문자열(비우기)", () => {
    expect(diffToExtraRequest(initial, { ...initial, warrantyCoverage: "" })).toEqual({ warrantyCoverage: "" });
    expect(diffToExtraRequest(initial, { ...initial, warrantyCoverage: "환불" })).toEqual({ warrantyCoverage: "환불" });
  });

  it("파일은 지우면 빈 문자열, 교체하면 새 키, 새로 채우면 새 키", () => {
    expect(diffToExtraRequest(initial, { ...initial, certificateOfAuthen: "" })).toEqual({ certificateOfAuthen: "" });
    expect(diffToExtraRequest(initial, { ...initial, testReport: "new.pdf" })).toEqual({ testReport: "new.pdf" });
    expect(diffToExtraRequest(initial, { ...initial, replaceProd: "r.png" })).toEqual({ replaceProd: "r.png" });
  });
});

describe("extraFilledLabel", () => {
  it("보증·서류 n/5", () => {
    expect(extraFilledLabel(3)).toBe("보증·서류 3/5");
    expect(extraFilledLabel(0)).toBe("보증·서류 0/5");
  });
});
