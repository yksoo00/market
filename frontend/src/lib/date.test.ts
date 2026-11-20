import { describe, expect, it } from "vitest";
import { displayDate, normalizeDate, normalizeDateOrKeep, reviveDates } from "@/lib/date";

describe("normalizeDate", () => {
  it("구분 문자·앞뒤 공백이 있어도 YYYY-MM-DD 로", () => {
    for (const s of ["2026-10-10", "2026.10.10", "2026/10/10", " 2026-10-10 ", "20261010", "2026 10 10"]) {
      expect(normalizeDate(s)).toBe("2026-10-10");
    }
  });

  it("글자가 섞이거나 없는 날짜·자릿수 틀림은 null", () => {
    for (const s of ["2026-03-0a3", "2026-13-45", "2026-02-30", "26-10-10", "2026-10-100", "", "  "]) {
      expect(normalizeDate(s)).toBeNull();
    }
  });

  it("normalizeDateOrKeep: 틀린 값은 그대로 둔다", () => {
    expect(normalizeDateOrKeep("2026.03.03")).toBe("2026-03-03");
    expect(normalizeDateOrKeep("2026-03-0a3")).toBe("2026-03-0a3");
  });
});

describe("응답 날짜 변환", () => {
  it("yyyyMMdd 8자리만 YYYY-MM-DD 로, 이미 하이픈이거나 다른 값은 그대로", () => {
    expect(displayDate("20261010")).toBe("2026-10-10");
    expect(displayDate("2026-10-10")).toBe("2026-10-10");
    expect(displayDate("20261014134400")).toBe("20261014134400");
  });

  it("reviveDates: 날짜 키만 바꾸고 등록일시(regDate)·다른 칸은 건드리지 않는다", () => {
    const body = { items: [{ deliveryDate: "20261010", regDate: "20261014134400", reqDeliDate: "20261011", name: "20261010" }], provDate: null };
    expect(reviveDates(body)).toEqual({
      items: [{ deliveryDate: "2026-10-10", regDate: "20261014134400", reqDeliDate: "2026-10-11", name: "20261010" }],
      provDate: null,
    });
  });
});
