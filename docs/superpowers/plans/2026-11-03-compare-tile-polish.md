# 비교·장바구니 칸 규칙·구매 시 비교 제거·빈 화면·비교 표 정리 (2026-11-03)

## 설계
사용자 지시(2026-11-03 대화, 추천안 전부 승인): ① 검색은 주기능 자리, 장바구니·비교는 보조 자리(`tileQueue` 의 `swapMain`) ② 구매요청이 되면 그 매물이 비교에서 빠진다(서버 `TradeService.dropCompareRow`, 견적 요청은 그대로) ③ 빈 장바구니·빈 비교의 [상품 검색] 제거 ④ 비교 표 열 폭을 개수로 나누고(최소 144) [빼기]는 사진 모서리 ✕, [견적 요청]·[구매]는 같은 폭 한 줄. 새 화면·테이블·API 없음 (구매 API 가 비교 행을 지우는 부수 효과만 더함).

### 칸 체크리스트 (frontend.md)
1. 화면 표: 새 `page.tsx` 없음. `myCart`·`cartCompare` 에 `aux` 표시만 추가.
2. 코드 이동은 기존 `useTileOpen()` 그대로.
3. 헤더 변경 없음. 4. 직접 확인: 비교(보조)에서 검색 열기 → 검색이 위 칸, 비교가 아래 칸. 5. 모달 크기 변경 없음.
6. E2E: 비교 화면(iframe 칸)에서 구매 → 비교에서 빠지고 빈 안내(버튼 없음).

## 작업
1. 백엔드: `dropCompareRow` + `purchase`·`purchaseFromQuote` 호출, `CompareApiTest` (구매는 그 매물만 빼고 견적은 비교 유지).
2. 프론트 lib: `tileScreens.isAux`, `tileQueue` `swapMain` + 단위 테스트.
3. 프론트 화면: `CartView`·`CompareView` 빈 화면, 비교 표 폭·✕·버튼 한 줄, 구매 완료 안내가 빈 화면에서도 보이게, 상세의 비교 상태 다시 읽기.
4. E2E `compare.spec.ts`, docs(decisions·design).
