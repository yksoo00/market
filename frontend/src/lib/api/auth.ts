import { api, post } from "@/lib/api/client";
import { clearBulk } from "@/lib/bulkStorage";
import { clearBuyBulk } from "@/lib/buyBulkStorage";

// 경로는 백엔드 구현 시 확정. 지금은 rules/backend.md 규칙대로 추정한 값
export const authApi = {
  me: () => api<{ id: string; kind: "PERSONAL" | "BUSINESS"; nickname: string }>("/api/v1/users/me", { cache: "no-store" }),
  // 다량 등록·대량구매 작업 보관본(sessionStorage)은 계정 구분 없이 한 키라, 로그아웃·로그인 때 비워 다른 계정에 이어지지 않게 한다 (코드리뷰)
  logout: async () => {
    const result = await post<null>("/api/v1/auth/logout", {});
    clearBulk();
    clearBuyBulk();
    return result;
  },
  login: async (body: { loginId: string; password: string; remember: boolean }) => {
    const result = await post<{ userId: string }>("/api/v1/auth/login", body);
    if (result.ok) {
      clearBulk();
      clearBuyBulk();
    }
    return result;
  },

  /** 기업도 아이디·비밀번호 (2026-10-13) */
  loginBusiness: async (body: {
    loginId: string;
    password: string;
    remember: boolean;
  }) => {
    const result = await post<{ userId: string }>("/api/v1/auth/login/business", body);
    if (result.ok) {
      clearBulk();
      clearBuyBulk();
    }
    return result;
  },

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

  /** 일반 가입. 요청 필드는 trd_user_info 테이블의 계정·연락처 컬럼에 저장된다. */
  signupPersonal: (body: {
    name: string;
    nickname: string | null;
    nicknameUsage: "Y" | "N";
    loginId: string;
    email: string;
    password: string;
    phone: string;
    address: string;
    contactMethod: "1" | "2" | "3";
    agreeTerms: boolean;
    agreePrivacy: boolean;
  }) => post<{ userId: string }>("/api/v1/auth/signup/personal", body),

  // --- 기업 가입 ---
  /** 사업자번호만으로 조회. 국세청 실연동 전까지 로컬 환경에서만 임시 가입 토큰을 발급한다. */
  verifyBusiness: (body: { bizNo: string }) =>
    post<{ verificationToken: string }>(
      "/api/v1/auth/signup/business/verify",
      body,
    ),

  signupBusiness: (body: {
    verificationToken: string;
    loginId: string;
    password: string;
    bizType: "corporation" | "individual";
    companyName: string;
    /** YYYYMMDD */
    startDate: string;
    address: string;
    contactName: string;
    contactPhone: string;
    contactEmail: string;
    companyTel: string;
    contactMethod: "1" | "2" | "3";
    agreeTerms: boolean;
    agreePrivacy: boolean;
  }) => post<{ userId: string }>("/api/v1/auth/signup/business", body),
};
