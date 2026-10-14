package com.company.market.user.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record SignupBusinessRequest(
		@NotBlank(message = "사업자등록번호를 조회하세요.") String verificationToken,
		@NotBlank(message = "아이디를 입력하세요.")
		@Pattern(regexp = "^[a-z][a-z0-9]{4,19}$", message = "아이디는 영문 소문자로 시작하는 영문 소문자·숫자 5~20자입니다.") String loginId,
		@NotBlank(message = "비밀번호를 입력하세요.")
		@Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{10,32}$",
				message = "비밀번호는 10~32자, 영문·숫자·특수문자를 각각 1자 이상 포함해야 합니다.") String password,
		@NotBlank(message = "기업 구분을 선택하세요.")
		@Pattern(regexp = "^(corporation|individual)$", message = "기업 구분이 올바르지 않습니다.") String bizType,
		@NotBlank(message = "기업명을 입력하세요.") @Size(min = 2, max = 50, message = "기업명은 2~50자입니다.") String companyName,
		@NotBlank(message = "개업년월일을 입력하세요.")
		@Pattern(regexp = "^\\d{8}$", message = "개업년월일은 YYYYMMDD 8자리입니다.") String startDate,
		@NotBlank(message = "주소를 입력하세요.") @Size(max = 200, message = "주소는 200자 이하입니다.") String address,
		@NotBlank(message = "담당자명을 입력하세요.")
		@Pattern(regexp = "^[가-힣A-Za-z][가-힣A-Za-z ]{0,28}[가-힣A-Za-z]$", message = "담당자명은 한글·영문 2~30자입니다.") String contactName,
		@NotBlank(message = "휴대폰 번호를 입력하세요.")
		@Pattern(regexp = "^01[016789]\\d{8}$", message = "휴대폰 번호 형식이 올바르지 않습니다.") String contactPhone,
		@NotBlank(message = "이메일을 입력하세요.") @Size(max = 100, message = "이메일은 100자 이하입니다.") @Email(message = "이메일 형식이 올바르지 않습니다.") String contactEmail,
		@Size(max = 20, message = "회사 전화번호는 20자 이하입니다.") String companyTel,
		@NotBlank(message = "연락 수단을 선택하세요.")
		@Pattern(regexp = "^[123]$", message = "연락 수단을 선택하세요.") String contactMethod,
		@AssertTrue(message = "이용약관(기업회원)에 동의해야 가입할 수 있습니다.") boolean agreeTerms,
		@AssertTrue(message = "개인정보 처리방침에 동의해야 가입할 수 있습니다.") boolean agreePrivacy) {
}
