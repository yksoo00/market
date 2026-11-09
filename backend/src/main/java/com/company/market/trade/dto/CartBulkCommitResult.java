package com.company.market.trade.dto;

import java.util.List;

/**
 * 엑셀 대량구매 담기 결과 — 줄마다 따로 담아서 부분 성공이다(담긴 줄은 그대로, 실패한 줄만 사유와 함께 남는다).
 * results 는 입력 줄과 같은 개수·순서. cartCount 는 담은 뒤 장바구니 줄 수
 */
public record CartBulkCommitResult(List<Outcome> results, long cartCount) {

	/** code 는 실패 때만 (ErrorCode 이름, 또는 매물이 없는 줄은 NO_LISTING). message 는 화면에 보일 사유 */
	public record Outcome(int rowNo, boolean ok, String code, String message) {
	}

}
