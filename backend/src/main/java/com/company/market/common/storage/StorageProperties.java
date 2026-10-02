package com.company.market.common.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.unit.DataSize;

/**
 * application.yml 의 `app.storage.*`. root 는 업로드 파일 루트 디렉터리 — Compose 에선 volume 마운트 경로.
 * minFree 는 업로드를 받는 디스크 여유 공간 하한 — 업로드가 디스크를 채워 같은 디스크의 Postgres 까지 멈추지 않게.
 */
@ConfigurationProperties("app.storage")
public record StorageProperties(String root, DataSize minFree) {
}
