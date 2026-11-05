package com.company.market.listing.service;

import java.lang.annotation.Annotation;
import java.time.Clock;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import com.company.market.common.exception.ValidationException;
import com.company.market.common.time.KoreanDates;
import com.company.market.listing.domain.CategoryFragments;
import com.company.market.listing.domain.Product;
import com.company.market.listing.dto.BulkRowDto;
import com.company.market.listing.dto.BulkRowResult;
import com.company.market.listing.dto.BulkRowResult.Candidate;
import com.company.market.listing.dto.BulkRowResult.Status;
import com.company.market.listing.dto.ListingCreateRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 엑셀 판매상품 다량 등록 (계획 2026-11-05-bulk-listing-excel.md). 검사는 직접 등록(ListingService.create)과 같은 규칙을 쓴다 —
 * 줄을 ListingCreateRequest 로 바꿔 같은 Bean Validation 어노테이션으로 돌리고, 나머지 조건(최소주문량·납기일·카테고리)은 create 와 같은 문구다.
 * 서버는 줄 상태를 저장하지 않는다: 브라우저가 들고 있다가 검사·확정 때마다 전부 다시 보낸다.
 */
@Service
@RequiredArgsConstructor
public class ListingBulkService {

	private static final String REQUIRED = "필수 입력입니다.";

	private static final int CANDIDATE_LIMIT = 5;

	private static final String NO_PHOTO_NOTICE = "사진 없음 — 등록 후 수정에서 추가해 주세요.";

	private final ProductService products;

	private final CategoryService categories;

	private final Validator validator;

	private final Clock clock;

	/**
	 * 줄별 검사 결과. 저장은 안 한다. 트랜잭션을 걸지 않는다 — CategoryService.resolveMinor 가 예외로 끝나며 바깥 트랜잭션을
	 * rollback-only 로 표시해, 잡아서 줄 오류로 바꿔도 UnexpectedRollbackException 이 나기 때문이다
	 */
	public List<BulkRowResult> check(UUID userId, List<BulkRowDto> rows) {
		return checkAll(rows).stream().map(Checked::result).toList();
	}

	/** 검사 결과 + 확정(commit)이 쓸 해석값. 신규 마스터의 category 는 NEW_MASTER 일 때만 있다 */
	record Checked(BulkRowResult result, ListingCreateRequest request, Product master, CategoryFragments category) {
	}

	List<Checked> checkAll(List<BulkRowDto> rows) {
		if (rows == null || rows.isEmpty() || rows.size() > ListingBulkParser.MAX_ROWS) {
			throw new ValidationException(Map.of("rows", "등록할 줄은 1~" + ListingBulkParser.MAX_ROWS + "개여야 합니다."));
		}
		Set<String> seen = new HashSet<>();
		return rows.stream().map(row -> checkOne(row, seen)).toList();
	}

	private Checked checkOne(BulkRowDto row, Set<String> seen) {
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
		List<String> notices = status != Status.FAILED && (master == null || isBlank(master.getProdPhoto1())) ? List.of(NO_PHOTO_NOTICE)
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
		try {
			return Integer.valueOf(raw.replace(",", "").replaceAll("\\s+", ""));
		}
		catch (NumberFormatException e) {
			fields.putIfAbsent(field, "숫자(정수)로 입력해 주세요.");
			return null;
		}
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
