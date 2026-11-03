import type { ListingDetail, ListingSearchItem } from "@/types/listing";

// 검색·내 판매글 목록의 한 행을 매물 상세 값으로 맞춘다 (구매 뒤 그 매물만 다시 읽을 때)

/** 상세 값으로 표의 행을 갱신한다. 파일 칸은 표가 유무만 보여 준다 */
export function applyDetailToItem(item: ListingSearchItem, d: ListingDetail): ListingSearchItem {
  return {
    ...item,
    prodNo: d.prodNo,
    prodName: d.prodName,
    prodBrand: d.prodBrand,
    category: d.category,
    mufcDate: d.mufcDate,
    prodDescription: d.description,
    hasDataSheet: d.listingDataSheet !== null,
    hasPhoto: d.photos.length > 0,
    mainPhoto: d.photos[0] ?? null,
    warrantyUntil: d.warrantyUntil,
    warrantyCoverage: d.warrantyCoverage,
    hasReplaceProd: d.replaceProd !== null,
    hasTestReport: d.testReport !== null,
    hasCertificate: d.certificateOfAuthen !== null,
    prodState: d.prodState,
    stockQuantity: d.stockQuantity,
    salesUnitPrice: d.salesUnitPrice,
    deliveryDate: d.deliveryDate,
    tradeStatus: d.tradeStatus,
    minOrderQuantity: d.minOrderQuantity,
    orderUnit: d.orderUnit,
    categoryPath: d.categoryPath,
  };
}

/** 목록에서 그 매물(userId·regDate) 행만 상세 값으로 바꾼다. 구매 뒤 다시 읽기에 쓴다 */
export function replaceRow(items: ListingSearchItem[], d: ListingDetail): ListingSearchItem[] {
  return items.map((i) => (i.userId === d.userId && i.regDate === d.regDate ? applyDetailToItem(i, d) : i));
}
