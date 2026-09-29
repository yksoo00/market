package com.company.market.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 일반 가입. 수치·정규식은 docs/security.md "입력 검증 > 계정" 이 원본이고 프론트 `lib/validation/{auth,signup}.ts` 와 같다.
 * "비밀번호에 아이디 포함 금지"는 두 필드가 필요해 SignupService 에서 검사.
 */
public record SignupPersonalRequest(
		@NotBlank(message = "이름을 입력하세요.")
		@Pattern(regexp = "^[가-힣A-Za-z][가-힣A-Za-z ]{0,28}[가-힣A-Za-z]$", message = "이름은 한글·영문 2~30자입니다.") String name,
		@Size(min = 2, max = 20, message = "닉네임은 2~20자입니다.") String nickname,
		@NotBlank(message = "별명 사용 여부를 선택하세요.")
		@Pattern(regexp = "^[YN]$", message = "별명 사용 여부를 선택하세요.") String nicknameUsage,
		@NotBlank(message = "아이디를 입력하세요.")
		@Pattern(regexp = "^[a-z][a-z0-9]{4,19}$", message = "아이디는 영문 소문자로 시작하는 영문 소문자·숫자 5~20자입니다.") String loginId,
		@NotBlank(message = "이메일을 입력하세요.") @Size(max = 100, message = "이메일은 100자 이하입니다.")
		@Email(message = "이메일 형식이 올바르지 않습니다.") String email,
		@NotBlank(message = "비밀번호를 입력하세요.")
		@Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{10,32}$",
				message = "비밀번호는 10~32자, 영문·숫자·특수문자를 각각 1자 이상 포함해야 합니다.") String password,
		@NotBlank(message = "휴대폰 번호를 입력하세요.")
		@Pattern(regexp = "^01[016789]\\d{8}$", message = "휴대폰 번호 형식이 올바르지 않습니다.") String phone,
		@Size(max = 20, message = "전화번호는 20자 이하입니다.") String tel,
		@Size(max = 200, message = "주소는 200자 이하입니다.") String address,
		@NotBlank(message = "연락 수단을 선택하세요.")
		@Pattern(regexp = "^[123]$", message = "연락 수단을 선택하세요.") String contactMethod) {
}
