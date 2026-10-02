package com.company.market.common.storage;

/** 요청 필드 하나에 들어온 업로드 키와, 그 필드가 받아야 하는 용도. field 는 실패 시 fields.<field> 로 응답된다 */
public record UploadRef(String field, String key, UploadKind kind) {
}
