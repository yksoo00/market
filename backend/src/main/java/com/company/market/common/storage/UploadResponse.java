package com.company.market.common.storage;

/** 업로드 결과. key 를 매물 등록·수정 요청의 경로 필드에 그대로 넣는다 */
public record UploadResponse(String key) {
}
