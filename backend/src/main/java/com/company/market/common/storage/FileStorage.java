package com.company.market.common.storage;

import java.io.IOException;
import java.io.InputStream;
import java.util.Optional;

import org.springframework.core.io.Resource;

/**
 * 파일 저장소. 지금은 서버 로컬 디스크(LocalFileStorage) 하나지만, 서버가 늘어 MinIO·S3 로 옮길 때
 * 구현만 바꾸도록 이 인터페이스만 거친다 (decisions.md 2026-10-02).
 */
public interface FileStorage {

	/** key 는 UploadKind 키 형식이어야 한다. 아니면 IllegalArgumentException */
	void save(String key, InputStream content) throws IOException;

	/** 없거나 키 형식이 아니면 empty */
	Optional<Resource> open(String key);

}
