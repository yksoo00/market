import { post } from "@/lib/api/client";

// 경로는 백엔드 구현 시 확정. 지금은 rules/backend.md 규칙대로 추정한 값
export const authApi = {
  login: (body: { loginId: string; password: string; remember: boolean }) =>
    post<{ userId: string }>("/api/v1/auth/login", body),

  loginBusiness: (body: { bizNo: string; password: string; remember: boolean }) =>
    post<{ userId: string }>("/api/v1/auth/login/business", body),

  /** 본인인증 토큰으로 아이디 조회. 아이디는 마스킹해서 옴 (ab***12) */
  findId: (body: { verificationToken: string }) =>
    post<{ loginIdMasked: string; joinedAt: string }>("/api/v1/auth/find-id", body),

  /** 아이디 + 본인인증 + 새 비밀번호를 한 번에. 인증한 사람이 계정 소유자인지는 서버가 CI 로 대조 */
  resetPassword: (body: { loginId: string; verificationToken: string; password: string }) =>
    post<null>("/api/v1/auth/password-reset", body),

  /** 기업: 담당자 이메일로 재설정 링크 발송. 가입 여부를 응답으로 알려주지 않음 (계정 존재 노출 방지) */
  requestBusinessPasswordReset: (body: { bizNo: string; email: string }) =>
    post<null>("/api/v1/auth/password-reset/business", body),

  /** 이메일 링크의 토큰으로 새 비밀번호 확정 */
  confirmPasswordReset: (body: { token: string; password: string }) =>
    post<null>("/api/v1/auth/password-reset/confirm", body),
};

export type SocialProvider = "kakao" | "naver" | "google";

/** 소셜 로그인은 페이지 이동. 콜백은 백엔드가 처리하고 쿠키를 심은 뒤 next 로 돌려보냄 */
export function socialLoginUrl(provider: SocialProvider, next: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
  return `${base}/api/v1/auth/oauth/${provider}?next=${encodeURIComponent(next)}`;
}
