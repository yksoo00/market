// 가입 화면 주소. 유형 선택 화면 없이 로그인 화면의 개인·기업 탭에서 바로 온다 (decisions.md 2026-10-13).
// 기업 가입은 사업자 인증 단계를 따로 두지 않고 한 페이지라, 단계 사이에 넘기던 임시 상태(sessionStorage)는 없앴다.
export const personalSignupPath = { form: "/signup/personal/form" } as const;
export const businessSignupPath = { form: "/signup/business/form" } as const;
