// 장바구니 한도. 서버 CartAddRequest.MAX_ADD·CartService.MAX_ITEMS 와 같다 (docs/security.md "입력 검증 > 장바구니")

/** 한 번에 담을 수 있는 매물 수 */
export const MAX_CART_ADD = 20;

/** 장바구니 합계 */
export const MAX_CART_ITEMS = 100;
