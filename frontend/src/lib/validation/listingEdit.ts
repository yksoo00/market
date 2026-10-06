import { z } from "zod";
import { isValidDate } from "@/lib/search";
import { isInt, MAX_DESCRIPTION, MAX_PHOTOS, MAX_PRICE, MAX_QUANTITY, PROD_STATES } from "@/lib/validation/listing";
import { listing } from "@/messages/listing";

const v = listing.validation;

// 값은 변환하지 않고 문자열 그대로 둔다 — lib/listingEdit.diffToUpdateRequest 가 처음 값(문자열)과 비교한 뒤 숫자로 바꾼다
const requiredInt = (min: number, max: number, message: string) =>
  z.string().min(1, v.required).refine((s) => isInt(s) && Number(s) >= min && Number(s) <= max, message);

/**
 * 매물 수정 폼 검증. 규칙·수치는 등록 폼(listingFormSchema)과 같고 차이는 셋:
 * ① 재고·최소주문량·주문단위가 필수 — 등록 땐 비우면 서버 기본값이지만 수정은 이미 값이 있는 칸이다.
 * ② 상태는 목록 값만 (옛 값이 구간에 안 맞으면 빈 값 → "선택하세요" 오류).
 * ③ 납기일이 처음 값 그대로면 지난 날짜여도 통과 — 서버도 저장된 값과 같으면 통과시킨다 (다른 칸 수정이 막히지 않게).
 * today = 한국 날짜 YYYY-MM-DD.
 */
export function listingEditSchema(today: string, initialDeliveryDate: string) {
  return z
    .object({
      prodState: z.string().refine((s) => (PROD_STATES as readonly string[]).includes(s), v.prodState),
      salesUnitPrice: requiredInt(0, MAX_PRICE, v.salesUnitPrice),
      salesQuantity: requiredInt(1, MAX_QUANTITY, v.salesQuantity),
      stockQuantity: requiredInt(0, MAX_QUANTITY, v.stockQuantity),
      minOrderQuantity: requiredInt(1, MAX_QUANTITY, v.minOrderQuantity),
      orderUnit: requiredInt(1, MAX_QUANTITY, v.orderUnit),
      deliveryDate: z.string().refine((s) => s === "" || isValidDate(s), v.date),
      description: z.string().trim().max(MAX_DESCRIPTION, v.description),
      photos: z.array(z.string()).max(MAX_PHOTOS, v.photos),
      listingDataSheet: z.string(),
    })
    // zod 4는 칸 검사가 실패해도 이 단계를 돈다 → 값이 문자열일 때만 비교한다
    .superRefine((d, ctx) => {
      const min = Number(d.minOrderQuantity);
      const sales = Number(d.salesQuantity);
      // 두 칸 모두 자기 범위를 통과했을 때만 비교 — 판매수량 0 이 최소주문량 오류까지 만들지 않게
      const minOk = isInt(d.minOrderQuantity) && min >= 1 && min <= MAX_QUANTITY;
      const salesOk = isInt(d.salesQuantity) && sales >= 1 && sales <= MAX_QUANTITY;
      if (minOk && salesOk && min > sales) {
        ctx.addIssue({ code: "custom", path: ["minOrderQuantity"], message: v.minOrderOverSales });
      }
      // YYYY-MM-DD 문자열은 사전순 = 날짜순. 형식이 틀린 값은 위 칸 검사가 이미 잡았다
      if (d.deliveryDate !== "" && isValidDate(d.deliveryDate) && d.deliveryDate !== initialDeliveryDate && d.deliveryDate < today) {
        ctx.addIssue({ code: "custom", path: ["deliveryDate"], message: v.deliveryDate });
      }
    });
}

export type ListingEditSchemaOutput = z.output<ReturnType<typeof listingEditSchema>>;
