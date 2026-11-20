package com.company.market.listing.service;

import java.io.IOException;
import java.io.InputStream;
import java.lang.annotation.Annotation;
import java.math.BigInteger;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.common.exception.ValidationException;
import com.company.market.common.storage.FileType;
import com.company.market.common.storage.UploadKind;
import com.company.market.common.storage.UploadRef;
import com.company.market.common.storage.UploadService;
import com.company.market.common.time.KoreanDates;
import com.company.market.listing.domain.CategoryFragments;
import com.company.market.listing.domain.Listing;
import com.company.market.listing.domain.Product;
import com.company.market.listing.dto.BulkFile;
import com.company.market.listing.dto.BulkParseResponse;
import com.company.market.listing.dto.BulkRowDto;
import com.company.market.listing.dto.BulkRowResult;
import com.company.market.listing.dto.BulkRowResult.Candidate;
import com.company.market.listing.dto.BulkRowResult.Status;
import com.company.market.listing.dto.ListingCreateRequest;
import com.company.market.listing.repository.ListingRepository;
import com.company.market.listing.service.ProductService.ProductDraft;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * 엑셀 판매상품 다량 등록 (계획 2026-11-05-bulk-listing-excel.md). 검사는 직접 등록(ListingService.create)과 같은 규칙을 쓴다 —
 * 줄을 ListingCreateRequest 로 바꿔 같은 Bean Validation 어노테이션으로 돌리고, 나머지 조건(최소주문량·납기일·카테고리)은 create 와 같은 문구다.
 * 서버는 줄 상태를 저장하지 않는다: 브라우저가 들고 있다가 검사·확정 때마다 전부 다시 보낸다.
 */
@Service
@RequiredArgsConstructor
public class ListingBulkService {

	private static final DateTimeFormatter REG_DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

	private static final String REQUIRED = "필수 입력입니다.";

	private static final int CANDIDATE_LIMIT = 5;

	private static final String NO_PHOTO_NOTICE = "사진 없음 — 등록 후 수정에서 추가해 주세요.";

	private final ProductService products;

	private final CategoryService categories;

	private final Validator validator;

	private final Clock clock;

	private final ListingRepository listings;

	private final ListingBulkParser parser;

	private final UploadService uploads;

	private final ListingBulkArchive archive;

	/**
	 * 업로드한 엑셀을 읽고 줄마다 검사한다 (저장 없음). 데이터 줄이 하나도 없으면 빈 결과 — 화면이 "입력한 줄이 없어요"를 보이게
	 */
	public BulkParseResponse parse(String userId, MultipartFile file, MultipartFile zip) {
		String name = file.getOriginalFilename();
		if (file.isEmpty() || name == null || !name.toLowerCase(Locale.ROOT).endsWith(".xlsx")) {
			throw new ValidationException(Map.of("file", "엑셀(.xlsx) 파일을 올려 주세요."));
		}
		if (file.getSize() > ListingBulkParser.MAX_FILE_BYTES) {
			throw new ValidationException(Map.of("file", "엑셀 파일은 10MB 이하로 올려 주세요."));
		}
		List<BulkRowDto> rows;
		try (InputStream in = file.getInputStream()) {
			rows = parser.parse(in);
		}
		catch (IOException e) {
			throw new ValidationException(Map.of("file", "엑셀(.xlsx) 파일을 읽을 수 없습니다."));
		}
		rows = attach(userId, rows, zip);
		return new BulkParseResponse(rows, rows.isEmpty() ? List.of() : check(userId, rows));
	}

	/**
	 * ZIP 이 있으면 엑셀 칸의 파일명과 같은 ZIP 안 파일을 저장해 키를 줄에 붙인다. ZIP 구조·총량 검증(index)이 끝난 뒤에만 저장을
	 * 시작한다 — 거절된 ZIP 이 파일을 남기지 않게. 칸마다 문제(ZIP 에 없음·형식·용량)는 줄 오류가 되도록 problem 에 담는다.
	 * 엑셀이 쓰지 않는 ZIP 파일은 저장하지 않는다. 같은 이름을 여러 칸이 써도 칸마다 따로 저장한다(키 하나를 두 매물이 나눠 쓰지 못함)
	 */
	private List<BulkRowDto> attach(String userId, List<BulkRowDto> rows, MultipartFile zip) {
		if (zip == null) {
			return rows;
		}
		// 빈 ZIP 을 조용히 넘기면 엑셀에 적은 이름이 전부 "ZIP 이 없다"로 보여 ZIP 을 안 보낸 것처럼 읽힌다
		if (zip.isEmpty()) {
			throw new ValidationException(Map.of("attachments", "ZIP 파일이 비어 있습니다."));
		}
		if (rows.isEmpty()) {
			return rows;
		}
		String zipName = zip.getOriginalFilename();
		if (zipName == null || !zipName.toLowerCase(Locale.ROOT).endsWith(".zip")) {
			throw new ValidationException(Map.of("attachments", "ZIP(.zip) 파일을 올려 주세요."));
		}
		ListingBulkArchive.Index index = archive.index(zip);

		BulkFile[][] files = rows.stream().map(BulkRowDto::files).toArray(BulkFile[][]::new);
		Map<String, List<int[]>> uses = new HashMap<>();
		for (int i = 0; i < files.length; i++) {
			for (int j = 0; j < files[i].length; j++) {
				BulkFile f = files[i][j];
				if (f == null || !f.hasName()) {
					continue;
				}
				UploadKind kind = kindOf(j);
				String name = ListingBulkArchive.normalize(f.name());
				if (FileType.fromFilename(f.name()).filter(kind::allows).isEmpty()) {
					files[i][j] = new BulkFile(f.name(), null, wrongType(kind));
				}
				else if (!index.names().contains(name)) {
					files[i][j] = new BulkFile(f.name(), null, "ZIP 안에서 찾을 수 없습니다.");
				}
				else {
					uses.computeIfAbsent(name, k -> new ArrayList<>()).add(new int[] { i, j });
				}
			}
		}
		try {
			archive.read(zip, index.charset(), uses.keySet(), (name, content) -> {
				for (int[] use : uses.get(name)) {
					BulkFile f = files[use[0]][use[1]];
					UploadKind kind = kindOf(use[1]);
					if (content == null) {
						files[use[0]][use[1]] = new BulkFile(f.name(), null, tooLarge(kind));
						continue;
					}
					try {
						files[use[0]][use[1]] = new BulkFile(f.name(), uploads.store(userId, kind, f.name(), content), null);
					}
					catch (ApiException e) {
						// 디스크 부족은 줄 하나의 문제가 아니라 서버 상태 — 그대로 올려 보낸다
						if (e.getCode() == ErrorCode.UPLOAD_INVALID_TYPE) {
							files[use[0]][use[1]] = new BulkFile(f.name(), null, wrongType(kind));
						}
						else if (e.getCode() == ErrorCode.UPLOAD_TOO_LARGE) {
							files[use[0]][use[1]] = new BulkFile(f.name(), null, tooLarge(kind));
						}
						else {
							throw e;
						}
					}
				}
			});
		}
		catch (IOException e) {
			throw new ValidationException(Map.of("attachments", "ZIP 파일을 읽을 수 없습니다."));
		}
		List<BulkRowDto> attached = new ArrayList<>();
		for (int i = 0; i < rows.size(); i++) {
			attached.add(rows.get(i).withFiles(files[i]));
		}
		return attached;
	}

	/** FILE_FIELDS 의 j 번째 칸 용도: 사진1~4 는 사진, 마지막은 데이터시트 */
	private static UploadKind kindOf(int slot) {
		return slot < 4 ? UploadKind.LISTING_PHOTO : UploadKind.LISTING_DATASHEET;
	}

	private static String wrongType(UploadKind kind) {
		return kind == UploadKind.LISTING_PHOTO ? "사진은 jpg·png·webp 파일이어야 합니다." : "데이터시트는 pdf 파일이어야 합니다.";
	}

	private static String tooLarge(UploadKind kind) {
		return "파일이 너무 큽니다 (" + kind.maxBytes() / 1024 / 1024 + "MB 이하).";
	}

	/**
	 * 줄별 검사 결과. 저장은 안 한다. 트랜잭션을 걸지 않는다 — CategoryService.resolveMinor 가 예외로 끝나며 바깥 트랜잭션을
	 * rollback-only 로 표시해, 잡아서 줄 오류로 바꿔도 UnexpectedRollbackException 이 나기 때문이다
	 */
	public List<BulkRowResult> check(String userId, List<BulkRowDto> rows) {
		return checkAll(rows).stream().map(Checked::result).toList();
	}

	/**
	 * 확정. 줄을 전부 다시 검사하고(브라우저가 "통과"라고 한 것은 믿지 않는다) 하나라도 걸리면 아무것도 저장하지 않는다.
	 * 잠금 순서는 직접 등록과 같다 — 마스터 생성 잠금 → 사용자 등록 잠금 (교착 방지).
	 * 등록 시각(regDate)은 직접 등록처럼 같은 사용자 같은 초를 못 쓰므로, 시작 시각부터 줄 순서대로 1초씩 올려 부여한다
	 * (이미 있는 초는 건너뛴다). 200줄이면 최대 약 3분 뒤 시각이 찍힌다 — 계획 2026-11-05 가정 1.
	 */
	@Transactional
	public int commit(String userId, List<BulkRowDto> rows) {
		List<Checked> checked = checkAll(rows);
		Map<String, String> failures = new LinkedHashMap<>();
		for (Checked c : checked) {
			c.result().fields().forEach((field, message) -> failures.put(c.result().rowNo() + "." + field, message));
		}
		if (!failures.isEmpty()) {
			throw new ApiException(ErrorCode.LISTING_BULK_INVALID, ErrorCode.LISTING_BULK_INVALID.message(), failures);
		}

		List<Product> resolved = checked.stream().map(c -> c.master() != null ? c.master() : products.findOrCreate(
				new ProductDraft(c.category(), c.request().prodName(), c.request().prodNo(), c.request().prodBrand(),
						c.request().prodClassNo(), null, null, null, null, null, null))).toList();

		// 키는 본인이 24시간 안에 그 용도로 올린 것만 받는다 (본문의 키를 그대로 믿지 않음). 실패하면 이 트랜잭션 전체가 롤백
		List<UploadRef> refs = new ArrayList<>();
		for (BulkRowDto row : rows) {
			BulkFile[] files = row.files();
			for (int j = 0; j < files.length; j++) {
				if (files[j] != null && files[j].hasName() && !isBlank(files[j].key())) {
					refs.add(new UploadRef(row.rowNo() + "." + BulkRowDto.FILE_FIELDS[j], files[j].key(), kindOf(j)));
				}
			}
		}
		uploads.claim(userId, refs);

		listings.lockRegistration(userId);
		LocalDateTime cursor = LocalDateTime.now(clock);
		for (int i = 0; i < checked.size(); i++) {
			ListingCreateRequest req = checked.get(i).request();
			BulkRowDto row = rows.get(i);
			List<String> zipPhotos = photoKeys(row);
			String zipSheet = dataSheetKey(row);
			Product product = resolved.get(i);
			while (listings.existsByUserIdAndRegDate(userId, cursor.format(REG_DATE_FORMAT))) {
				cursor = cursor.plusSeconds(1);
			}
			int quantity = req.salesQuantity();
			listings.saveAndFlush(Listing.builder()
				.userId(userId)
				.regDate(cursor.format(REG_DATE_FORMAT))
				.prodId(product.getProdId())
				.tradeType(req.tradeType())
				.prodState(req.prodState())
				.salesUnitPrice(req.salesUnitPrice())
				.salesQuantity(quantity)
				.minOrderQuantity(req.minOrderQuantity() == null ? 1 : req.minOrderQuantity())
				.orderUnit(req.orderUnit() == null ? 1 : req.orderUnit())
				.deliveryDate(req.deliveryDate())
				.stockQuantity(quantity)
				.prodDescription(req.description())
				// ZIP 파일이 있으면 그것만, 없으면 마스터 값 (계획 2026-11-18 가정 4)
				.prodDataSheet(zipSheet != null ? zipSheet : product.getProdDataSheet())
				.prodPhoto1(zipPhotos.isEmpty() ? product.getProdPhoto1() : zipPhotos.get(0))
				.prodPhoto2(zipPhotos.size() > 1 ? zipPhotos.get(1) : null)
				.prodPhoto3(zipPhotos.size() > 2 ? zipPhotos.get(2) : null)
				.prodImage4(zipPhotos.size() > 3 ? zipPhotos.get(3) : null)
				.build());
			cursor = cursor.plusSeconds(1);
		}
		return checked.size();
	}

	/** 검사 결과 + 확정(commit)이 쓸 해석값. 신규 마스터의 category 는 NEW_MASTER 일 때만 있다 */
	record Checked(BulkRowResult result, ListingCreateRequest request, Product master, CategoryFragments category) {
	}

	List<Checked> checkAll(List<BulkRowDto> rows) {
		if (rows == null || rows.isEmpty() || rows.size() > ListingBulkParser.MAX_ROWS) {
			throw new ValidationException(Map.of("rows", "등록할 줄은 1~" + ListingBulkParser.MAX_ROWS + "개여야 합니다."));
		}
		// 줄 번호가 겹치면 화면의 줄 매칭과 확정 실패 키("줄번호.칸")가 섞인다
		if (rows.stream().map(BulkRowDto::rowNo).distinct().count() != rows.size()) {
			throw new ValidationException(Map.of("rows", "줄 번호가 겹칩니다."));
		}
		Set<String> seen = new HashSet<>();
		Set<String> usedKeys = new HashSet<>();
		return rows.stream().map(row -> checkOne(row, seen, usedKeys)).toList();
	}

	/**
	 * 첨부 칸 검사. 이름이 있는 칸만 본다 (이름 없는 칸의 키는 무시). 키가 없으면 parse 가 남긴 사유를, 그것도 없으면(ZIP 없이 올림)
	 * 안내를 칸 오류로. 키는 그 용도의 업로드 키 모양이어야 하고, 한 번 확정에서 한 키를 두 칸이 쓰면 안 된다 (claim 은 같은 키를 한 번만 선점)
	 */
	private static void checkFiles(BulkRowDto row, Map<String, String> fields, Set<String> usedKeys) {
		BulkFile[] files = row.files();
		for (int j = 0; j < files.length; j++) {
			BulkFile f = files[j];
			if (f == null || !f.hasName()) {
				continue;
			}
			String field = BulkRowDto.FILE_FIELDS[j];
			if (isBlank(f.key())) {
				fields.putIfAbsent(field, isBlank(f.problem()) ? "ZIP 파일을 함께 올려야 이 파일이 붙습니다." : f.problem());
			}
			else if (UploadKind.ofKey(f.key()).filter(kindOf(j)::equals).isEmpty()) {
				fields.putIfAbsent(field, "파일을 다시 올려 주세요.");
			}
			else if (!usedKeys.add(f.key())) {
				fields.putIfAbsent(field, "같은 파일을 두 칸에 쓸 수 없습니다.");
			}
		}
	}

	/** 키가 있는 사진 칸을 사진1~4 순서대로 (이름이 없는 칸은 건너뜀) */
	private static List<String> photoKeys(BulkRowDto row) {
		List<String> keys = new ArrayList<>();
		BulkFile[] files = row.files();
		for (int j = 0; j < 4; j++) {
			if (files[j] != null && files[j].hasName() && !isBlank(files[j].key())) {
				keys.add(files[j].key());
			}
		}
		return keys;
	}

	private static String dataSheetKey(BulkRowDto row) {
		BulkFile f = row.dataSheet();
		return f != null && f.hasName() && !isBlank(f.key()) ? f.key() : null;
	}

	private Checked checkOne(BulkRowDto row, Set<String> seen, Set<String> usedKeys) {
		Map<String, String> fields = new LinkedHashMap<>();
		String name = norm(row.prodName());
		String brand = norm(row.prodBrand());
		String classNo = norm(row.prodClassNo());
		String prodId = norm(row.prodId());

		Integer price = number(row.salesUnitPrice(), "salesUnitPrice", fields);
		Integer quantity = number(row.salesQuantity(), "salesQuantity", fields);
		Integer minOrder = optionalNumber(row.minOrderQuantity(), "minOrderQuantity", fields);
		Integer unit = optionalNumber(row.orderUnit(), "orderUnit", fields);

		ListingCreateRequest req = new ListingCreateRequest(prodId, norm(row.categoryCode()), name, norm(row.prodNo()), brand, classNo,
				null, null, null, null, null, "등록", norm(row.prodState()), price, quantity, minOrder, unit, norm(row.deliveryDate()),
				norm(row.description()), null, null);
		for (ConstraintViolation<ListingCreateRequest> v : validator.validate(req)) {
			fields.putIfAbsent(v.getPropertyPath().toString(), message(v));
		}
		checkFiles(row, fields, usedKeys);
		if (minOrder != null && quantity != null && minOrder > quantity) {
			fields.putIfAbsent("minOrderQuantity", "최소주문량은 판매수량을 넘을 수 없습니다.");
		}
		if (req.deliveryDate() != null && !fields.containsKey("deliveryDate")) {
			LocalDate date = KoreanDates.parseIso(req.deliveryDate());
			if (date == null) {
				fields.put("deliveryDate", "납기일이 올바른 날짜가 아닙니다.");
			}
			else if (date.isBefore(KoreanDates.today(clock))) {
				fields.put("deliveryDate", "납기일은 오늘 이후 날짜로 입력하세요.");
			}
		}

		Product master = null;
		CategoryFragments category = null;
		List<Candidate> candidates = List.of();
		boolean unmatched = false;
		if (prodId != null) {
			master = products.find(prodId).orElse(null);
			if (master == null) {
				fields.putIfAbsent("prodId", "없는 상품입니다.");
			}
		}
		else {
			if (name == null) {
				fields.putIfAbsent("prodName", REQUIRED);
			}
			if (brand == null) {
				fields.putIfAbsent("prodBrand", REQUIRED);
			}
			if (name != null && brand != null) {
				master = products.findSameIgnoreCase(name, brand, classNo).orElse(null);
				if (master == null) {
					unmatched = true;
					candidates = products.search(name).stream().limit(CANDIDATE_LIMIT)
						.map(p -> new Candidate(p.prodId(), p.prodName(), p.prodBrand(), p.prodClassNo())).toList();
					category = newMasterCategory(req.categoryCode(), fields);
				}
			}
		}

		String key = null;
		if (master != null) {
			key = "m:" + master.getProdId();
		}
		else if (unmatched) {
			key = "n:" + lower(name) + "|" + lower(brand) + "|" + lower(classNo);
		}
		if (key != null && !seen.add(key)) {
			fields.putIfAbsent(name != null ? "prodName" : "prodId", "파일 안에서 같은 상품이 이미 있어요.");
		}

		Status status = !fields.isEmpty() ? Status.FAILED : master != null ? Status.MATCHED : Status.NEW_MASTER;
		boolean noPhoto = photoKeys(row).isEmpty() && (master == null || isBlank(master.getProdPhoto1()));
		List<String> notices = status != Status.FAILED && noPhoto ? List.of(NO_PHOTO_NOTICE)
				: List.of();
		BulkRowResult result = new BulkRowResult(row.rowNo(), status, master == null ? null : master.getProdId(),
				master == null ? null : master.getProdName(), candidates, notices, fields);
		return new Checked(result, req, master, status == Status.NEW_MASTER ? category : null);
	}

	/** 새 마스터를 만들려면 카테고리가 있어야 한다 (직접 등록의 requireProductFields 와 같은 조건) */
	private CategoryFragments newMasterCategory(String categoryCode, Map<String, String> fields) {
		if (categoryCode == null) {
			fields.putIfAbsent("categoryCode", "마스터에 없는 상품이라 카테고리 코드가 필요합니다.");
			return null;
		}
		try {
			return categories.resolveMinor(categoryCode);
		}
		catch (ValidationException e) {
			fields.putIfAbsent("categoryCode", e.getFields().get("categoryCode"));
			return null;
		}
	}

	/** 필수 숫자 칸. 비면 필수, 글자면 형식 오류. 쉼표("1,000")는 허용 */
	private static Integer number(String raw, String field, Map<String, String> fields) {
		if (isBlank(raw)) {
			fields.putIfAbsent(field, REQUIRED);
			return null;
		}
		return parseInt(raw, field, fields);
	}

	private static Integer optionalNumber(String raw, String field, Map<String, String> fields) {
		return isBlank(raw) ? null : parseInt(raw, field, fields);
	}

	private static Integer parseInt(String raw, String field, Map<String, String> fields) {
		String digits = raw.replace(",", "").replaceAll("\\s+", "");
		if (!digits.matches("-?\\d+")) {
			fields.putIfAbsent(field, "숫자(정수)로 입력해 주세요.");
			return null;
		}
		// int 범위를 넘는 값은 끝값으로 맞춰 둔다 — 검증기의 @Max/@Min 이 "N 이하로 입력해 주세요"를 알려 준다 ("정수로 입력"이라고 하면 틀린 안내)
		BigInteger value = new BigInteger(digits);
		return value.max(BigInteger.valueOf(Integer.MIN_VALUE)).min(BigInteger.valueOf(Integer.MAX_VALUE)).intValue();
	}

	/** 제약 어노테이션의 값에서 한국어 문구를 만든다 — 수치는 ListingCreateRequest 가 원본이라 여기에 다시 적지 않는다 */
	private static String message(ConstraintViolation<?> v) {
		Annotation a = v.getConstraintDescriptor().getAnnotation();
		return switch (a) {
			case NotBlank n -> "deliveryDate".equals(v.getPropertyPath().toString()) ? ListingCreateRequest.DELIVERY_DATE_REQUIRED : REQUIRED;
			case NotNull n -> REQUIRED;
			case Size s -> s.max() + "자 이하로 입력해 주세요.";
			case Min m -> String.format(Locale.KOREA, "%,d 이상으로 입력해 주세요.", m.value());
			case Max m -> String.format(Locale.KOREA, "%,d 이하로 입력해 주세요.", m.value());
			default -> v.getMessage();
		};
	}

	/** 앞뒤 공백을 떼고 안쪽 공백 여러 개는 하나로. 빈 칸은 null */
	private static String norm(String s) {
		if (s == null) {
			return null;
		}
		String t = s.trim().replaceAll("\\s+", " ");
		return t.isEmpty() ? null : t;
	}

	private static String lower(String s) {
		return s == null ? "" : s.toLowerCase(Locale.ROOT);
	}

	private static boolean isBlank(String s) {
		return s == null || s.isBlank();
	}

}
