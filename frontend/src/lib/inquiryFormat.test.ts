import { describe, expect, it } from "vitest";
import { formatInquiryTime } from "@/lib/inquiryFormat";

describe("formatInquiryTime", () => {
  it("UTC 시각을 한국 시간으로 보인다", () => {
    expect(formatInquiryTime("2026-11-18T05:05:30Z")).toBe("2026-11-18 14:05");
  });

  it("날짜가 넘어가는 시각도 한국 기준이다", () => {
    expect(formatInquiryTime("2026-11-18T16:00:00.123456Z")).toBe("2026-11-19 01:00");
  });

  it("읽을 수 없는 값은 빈 문자열", () => {
    expect(formatInquiryTime("not-a-date")).toBe("");
  });
});
