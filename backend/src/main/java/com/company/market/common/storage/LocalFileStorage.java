package com.company.market.common.storage;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Optional;

import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

/**
 * 서버 디스크에 저장. 루트는 Docker volume 이라 api-1·api-2 가 같은 파일을 본다 (프로세스 메모리가 아니므로 stateless 유지).
 */
@Component
public class LocalFileStorage implements FileStorage {

	private final Path root;

	public LocalFileStorage(StorageProperties props) {
		this.root = Path.of(props.root()).toAbsolutePath().normalize();
	}

	@Override
	public void save(String key, InputStream content) throws IOException {
		Path target = resolve(key).orElseThrow(() -> new IllegalArgumentException("저장소 키 형식이 아닙니다."));
		Path dir = Files.createDirectories(target.getParent());
		// 같은 디렉터리의 임시 파일에 다 쓴 뒤 이름만 바꾼다 — 쓰다 끊긴 반쪽 파일이 키로 보이지 않게
		Path tmp = Files.createTempFile(dir, ".upload-", ".tmp");
		try {
			Files.copy(content, tmp, StandardCopyOption.REPLACE_EXISTING);
			Files.move(tmp, target, StandardCopyOption.ATOMIC_MOVE);
		}
		finally {
			Files.deleteIfExists(tmp);
		}
	}

	@Override
	public Optional<Resource> open(String key) {
		return resolve(key).filter(Files::isRegularFile).map(FileSystemResource::new);
	}

	/** 키 형식 검사가 1차 방어, 루트 밖으로 나가는지 정규화해서 한 번 더 본다 */
	private Optional<Path> resolve(String key) {
		if (UploadKind.ofKey(key).isEmpty()) {
			return Optional.empty();
		}
		Path path = root.resolve(key).normalize();
		return path.startsWith(root) ? Optional.of(path) : Optional.empty();
	}

}
