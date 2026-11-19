package com.company.market.listing.dto;

import jakarta.validation.constraints.Size;

/**
 * 다량 등록 한 줄의 첨부 한 칸(사진·데이터시트). name 은 엑셀 칸에 적은 파일명(화면 표시용),
 * key 는 ZIP 에서 꺼내 저장해 서버가 발급한 업로드 키 — 확정은 key 만 믿는다(UploadService.claim 이 본인 것인지 확인).
 * problem 은 parse 가 이 칸에서 만난 문제(ZIP 에 없음·형식·용량)를 줄 오류로 되살리려고 브라우저가 들고 다니는 안내 문구 —
 * 화면 표시용일 뿐이라 지워 보내도 key 가 없으면 어차피 거절된다.
 */
public record BulkFile(
		@Size(max = BulkRowDto.MAX_TEXT) String name,
		@Size(max = 100) String key,
		@Size(max = BulkRowDto.MAX_TEXT) String problem) {

	public boolean hasName() {
		return name != null && !name.isBlank();
	}

}
