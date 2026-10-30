import { describe, expect, it } from "vitest";
import { COMPARE_HREF, compareBlock, compareRows } from "./compare";
import type { ListingDetail, ListingSearchItem } from "@/types/listing";

const U1 = "11111111-1111-1111-1111-111111111111";
const REG = (n: number) => `2026102210000${n}`;

const searchItem = (regDate: string, category = "P01-Q01-R001"): ListingSearchItem =>
  ({ userId: U1, regDate, category, tradeStatus: "available" }) as ListingSearchItem;

const detail = (over: Partial<ListingDetail> = {}): ListingDetail => ({
  userId: U1,
  regDate: REG(1),
  prodId: "KP-2026-000001",
  prodName: "i7",
  prodBrand: "Intel",
  prodNo: null,
  prodSpecInfo: null,
  prodClassNo: null,
  prodUsefulLife: null,
  warrantyMethod: null,
  alterProdName: null,
  tradeType: "등록",
  prodState: "신품",
  salesUnitPrice: 10000,
  salesQuantity: 5,
  minOrderQuantity: 1,
  orderUnit: 1,
  deliveryDate: null,
  stockQuantity: 5,
  description: null,
  listingDataSheet: null,
  photos: [],
  warrantyPeriod: null,
  warrantyCoverage: null,
  replaceProd: null,
  testReport: null,
  certificateOfAuthen: null,
  dtUpdate: null,
  dtExpire: null,
  category: "P01-Q01-R001",
  categoryPath: "PC주요부품 > CPU/프로세서 > 인텔 CPU",
  mufcDate: null,
  tradeStatus: "available",
  warrantyUntil: null,
  ...over,
});

const row = (rows: ReturnType<typeof compareRows>, key: string) => {
  const found = rows.find((r) => r.key === key);
  if (!found) throw new Error(`no row ${key}`);
  return found;
};

describe("compareBlock", () => {
  it("2~4개, 같은 소분류만", () => {
    expect(compareBlock([searchItem(REG(1))])).toBe("tooFew");
    expect(compareBlock([searchItem(REG(1)), searchItem(REG(2))])).toBeNull();
    expect(compareBlock([1, 2, 3, 4].map((n) => searchItem(REG(n))))).toBeNull();
    expect(compareBlock([1, 2, 3, 4, 5].map((n) => searchItem(REG(n))))).toBe("tooMany");
  });

  it("소분류가 다르면 막는다 (중분류가 같아도)", () => {
    expect(compareBlock([searchItem(REG(1), "P01-Q01-R001"), searchItem(REG(2), "P01-Q01-R002")])).toBe("category");
  });
});

describe("COMPARE_HREF", () => {
  it("비교 화면 주소는 고정이다 — 고른 상품은 서버(내 비교 목록)가 들고 있어 주소에 안 싣는다", () => {
    expect(COMPARE_HREF).toBe("/my/cart/compare");
  });
});

describe("compareRows", () => {
  it("값이 다른 줄만 differs", () => {
    const rows = compareRows([detail(), detail({ regDate: REG(2), prodState: "90% 이상" })]);
    expect(row(rows, "brand").differs).toBe(false);
    expect(row(rows, "state").differs).toBe(true);
    expect(row(rows, "state").values).toEqual(["신품", "90% 이상"]);
  });

  it("최저가는 동점 모두, 거래완료는 후보에서 뺀다", () => {
    const rows = compareRows([
      detail({ salesUnitPrice: 9000 }),
      detail({ regDate: REG(2), salesUnitPrice: 9000 }),
      detail({ regDate: REG(3), salesUnitPrice: 8000, tradeStatus: "completed" }),
    ]);
    expect([...row(rows, "unitPrice").best]).toEqual([0, 1]);
    expect(row(rows, "unitPrice").badge).toBe("최저가");
  });

  it("값이 모두 같으면 가장 좋은 값을 표시하지 않는다", () => {
    const rows = compareRows([detail(), detail({ regDate: REG(2) })]);
    expect(row(rows, "unitPrice").best.size).toBe(0);
  });

  it("재고 최대·납기 가장 빠름·보증 가장 김·최소주문 최소, 값 없는 상품은 후보 아님", () => {
    const rows = compareRows(
      [
        detail({ stockQuantity: 3, deliveryDate: "2026-11-01", warrantyUntil: "2027-01-01", minOrderQuantity: 2 }),
        detail({ regDate: REG(2), stockQuantity: 7, deliveryDate: null, warrantyUntil: null, minOrderQuantity: 1 }),
        detail({ regDate: REG(3), stockQuantity: 4, deliveryDate: "2026-10-30", warrantyUntil: "2026-12-01", minOrderQuantity: 3 }),
      ],
      "2026-10-22",
    );
    expect([...row(rows, "stock").best]).toEqual([1]);
    expect([...row(rows, "leadTime").best]).toEqual([2]);
    expect([...row(rows, "warranty").best]).toEqual([0]);
    expect([...row(rows, "minOrder").best]).toEqual([1]);
  });

  it("최소주문량만큼 재고가 없으면(살 수 없음) 후보가 아니다", () => {
    const rows = compareRows([
      detail({ salesUnitPrice: 8000, stockQuantity: 1, minOrderQuantity: 5 }),
      detail({ regDate: REG(2), salesUnitPrice: 9000, stockQuantity: 10 }),
      detail({ regDate: REG(3), salesUnitPrice: 7000, stockQuantity: null }),
    ]);
    expect([...row(rows, "unitPrice").best]).toEqual([1]);
  });

  it("이미 끝난 보증은 가장 김 후보가 아니다", () => {
    const rows = compareRows(
      [detail({ warrantyUntil: "2026-10-01" }), detail({ regDate: REG(2), warrantyUntil: "2026-09-01" })],
      "2026-10-22",
    );
    expect(row(rows, "warranty").best.size).toBe(0);
  });

  it("상세 정보 표 줄을 그대로 쓰고 나머지 칸을 뒤에 붙인다", () => {
    const keys = compareRows([detail(), detail({ regDate: REG(2) })]).map((r) => r.key);
    expect(keys.slice(0, 3)).toEqual(["brand", "prodId", "leadTime"]);
    expect(keys.at(-1)).toBe("description");
  });

  it("서류는 있음/없음, 사진은 장 수", () => {
    const rows = compareRows([
      detail({ listingDataSheet: "private/a.pdf", photos: ["p1", "p2"] }),
      detail({ regDate: REG(2) }),
    ]);
    expect(row(rows, "dataSheet").values).toEqual(["있음", "없음"]);
    expect(row(rows, "photoCount").values).toEqual(["2장", "0장"]);
    expect(row(rows, "tradeStatus").values).toEqual(["거래 중", "거래 중"]);
  });
});
