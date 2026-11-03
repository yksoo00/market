import { describe, expect, it } from "vitest";
import { filterCount } from "@/lib/detailFilter";
import { emptyTradeFilter, parseTradeFilter, tradeApiParams, tradeFields, tradeSortColumn, TRADE_STATUS_VALUES } from "@/lib/tradeFilter";
import { listFilterSchema } from "@/lib/validation/historyFilter";

describe("parseTradeFilter (주소 → 필터)", () => {
  it("값이 없으면 전부 비고 상태는 전체", () => {
    expect(parseTradeFilter({}, "buyer")).toEqual(emptyTradeFilter());
  });

  it("상태는 그 역할이 볼 수 있는 값만 — 판매자에게 견적수락은 없다", () => {
    expect(parseTradeFilter({ status: "quoteAccepted" }, "buyer").status).toBe("quoteAccepted");
    expect(parseTradeFilter({ status: "quoteAccepted" }, "seller").status).toBe("");
    expect(parseTradeFilter({ status: "confirmed" }, "buyer").status).toBe("");
    expect(parseTradeFilter({ status: "x" }, "seller").status).toBe("");
  });

  it("검색어·기간·금액·정렬은 거래이력과 같은 정리", () => {
    expect(parseTradeFilter({ q: " 서버 ", from: "2026-10-01", min: "10", sort: "amountAsc" }, "seller")).toMatchObject({
      q: "서버",
      from: "2026-10-01",
      min: "10",
      sort: "amountAsc",
    });
    expect(parseTradeFilter({ from: "2026-02-30", max: "-1", sort: "x" }, "buyer")).toMatchObject({ from: "", max: "", sort: "latest" });
  });
});

describe("tradeApiParams", () => {
  it("값이 있는 것만, 상태를 더한다", () => {
    expect(tradeApiParams(emptyTradeFilter())).toEqual([]);
    expect(tradeApiParams({ ...emptyTradeFilter(), q: "R740", status: "requested", max: "500" })).toEqual([
      ["q", "R740"],
      ["maxAmount", "500"],
      ["status", "requested"],
    ]);
  });
});

describe("tradeFields", () => {
  it("역할마다 상태 선택지가 다르고, 기본(전체)은 걸린 칸으로 세지 않는다", () => {
    const status = (role: "buyer" | "seller") => {
      const f = tradeFields(role)[0];
      return f.kind === "select" ? f.options.map((o) => o.value) : [];
    };
    expect(status("buyer")).toEqual(["", ...TRADE_STATUS_VALUES.buyer]);
    expect(status("seller")).toEqual(["", "quoteRequested", "requested"]);
    expect(filterCount(tradeFields("buyer"), emptyTradeFilter())).toBe(0);
    expect(filterCount(tradeFields("buyer"), { ...emptyTradeFilter(), status: "requested", from: "2026-10-01" })).toBe(2);
  });
});

describe("listFilterSchema (상태 칸 있는 폼)", () => {
  const base = emptyTradeFilter();
  it("역할이 볼 수 있는 상태만 통과", () => {
    const seller = listFilterSchema(TRADE_STATUS_VALUES.seller);
    expect(seller.safeParse({ ...base, status: "requested" }).success).toBe(true);
    expect(seller.safeParse({ ...base, status: "" }).success).toBe(true);
    expect(seller.safeParse({ ...base, status: "quoteAccepted" }).success).toBe(false);
  });
});

describe("활동내역 요청·구매 탭의 정렬 (열 머리 정렬 2026-11-03)", () => {
  it("이 목록의 열 정렬 값과 기본 정렬은 읽고, 거래이력 전용 값(구분)과 모르는 값은 최신순", () => {
    expect(parseTradeFilter({ sort: "partyAsc" }, "buyer").sort).toBe("partyAsc");
    expect(parseTradeFilter({ sort: "reqDeliDesc" }, "seller").sort).toBe("reqDeliDesc");
    expect(parseTradeFilter({ sort: "statusAsc" }, "buyer").sort).toBe("statusAsc");
    expect(parseTradeFilter({ sort: "amountDesc" }, "buyer").sort).toBe("amountDesc");
    expect(parseTradeFilter({ sort: "oldest" }, "seller").sort).toBe("oldest");
    expect(parseTradeFilter({ sort: "sideAsc" }, "buyer").sort).toBe("latest");
    expect(parseTradeFilter({ sort: "x" }, "buyer").sort).toBe("latest");
  });

  it("tradeSortColumn: sort 값 → 열·방향, 열 정렬이 아니면 null", () => {
    expect(tradeSortColumn("reqDeliAsc")).toEqual({ column: "reqDeli", dir: "asc" });
    expect(tradeSortColumn("statusDesc")).toEqual({ column: "status", dir: "desc" });
    expect(tradeSortColumn("latest")).toBeNull();
    expect(tradeSortColumn("sideAsc")).toBeNull();
  });

  it("정렬 칩 글자: 열로 정한 값은 이 목록의 열 이름 + ▲▼", () => {
    const sort = tradeFields("buyer").find((f) => f.kind === "select" && f.key === "sort");
    expect(sort?.kind === "select" ? sort.labelOf?.("partyAsc") : null).toBe("상대 ▲");
    expect(sort?.kind === "select" ? sort.labelOf?.("reqDeliDesc") : null).toBe("납품희망일 ▼");
    expect(sort?.kind === "select" ? sort.labelOf?.("latest") : null).toBeUndefined();
  });
});
