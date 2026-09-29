import { api, post } from "@/lib/api/client";

// 경로는 백엔드 구현 시 확정. 지금은 rules/backend.md 규칙대로 추정한 값
export const authApi = {
  me: () => api<{ id: string; kind: "PERSONAL" | "BUSINESS"; nickname: string }>("/api/v1/users/me", { cache: "no-store" }),
  logout: () => post<null>("/api/v1/auth/logout", {}),
  login: (body: { loginId: string; password: string; remember: boolean }) =>
    post<{ userId: string }>("/api/v1/auth/login", body),

  loginBusiness: (body: {
    bizNo: string;
    password: string;
    remember: boolean;
  }) => post<{ userId: string }>("/api/v1/auth/login/business", body),

  /** 본인인증 토큰으로 아이디 조회. 아이디는 마스킹해서 옴 (ab***12) */
  findId: (body: { verificationToken: string }) =>
    post<{ loginIdMasked: string; joinedAt: string }>(
      "/api/v1/auth/find-id",
      body,
    ),

  /** 아이디 + 본인인증 + 새 비밀번호를 한 번에. 인증한 사람이 계정 소유자인지는 서버가 CI 로 대조 */
  resetPassword: (body: {
    loginId: string;
    verificationToken: string;
    password: string;
  }) => post<null>("/api/v1/auth/password-reset", body),

  /** 기업: 담당자 이메일로 재설정 링크 발송. 가입 여부를 응답으로 알려주지 않음 (계정 존재 노출 방지) */
  requestBusinessPasswordReset: (body: { bizNo: string; email: string }) =>
    post<null>("/api/v1/auth/password-reset/business", body),

  /** 이메일 링크의 토큰으로 새 비밀번호 확정 */
  confirmPasswordReset: (body: { token: string; password: string }) =>
    post<null>("/api/v1/auth/password-reset/confirm", body),

  // --- 가입 ---
  checkLoginId: (loginId: string) =>
    post<{ available: boolean }>("/api/v1/auth/signup/check-login-id", {
      loginId,
    }),

  checkNickname: (nickname: string) =>
    post<{ available: boolean }>("/api/v1/auth/signup/check-nickname", {
      nickname,
    }),

  /** 일반 가입. 요청 필드는 users 테이블의 계정·연락처 컬럼에 저장된다. */
  signupPersonal: (body: {
    name: string;
    nickname: string | null;
    nicknameUsage: "Y" | "N";
    loginId: string;
    email: string;
    password: string;
    phone: string;
    tel: string;
    address: string;
    contactMethod: "1" | "2" | "3";
  }) => post<{ userId: string }>("/api/v1/auth/signup/personal", body),

  // --- 기업 가입 ---
  /** 국세청 실연동 전까지 로컬 환경에서만 임시 가입 토큰을 발급한다. */
  verifyBusiness: (body: {
    bizNo: string;
    startDate: string;
    ownerName: string;
  }) =>
    post<{ verificationToken: string }>(
      "/api/v1/auth/signup/business/verify",
      body,
    ),

  signupBusiness: (body: {
    verificationToken: string;
    password: string;
    bizType: "corporation" | "individual";
    companyName: string;
    address: string;
    contactName: string;
    contactPhone: string;
    contactEmail: string;
    contactTel: string;
    companyTel: string;
  }) => post<{ userId: string }>("/api/v1/auth/signup/business", body),
};
