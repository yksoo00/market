package com.company.market.common.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** application.yml 의 `app.storage.*`. root 는 업로드 파일 루트 디렉터리 — Compose 에선 volume 마운트 경로 */
@ConfigurationProperties("app.storage")
public record StorageProperties(String root) {
}
