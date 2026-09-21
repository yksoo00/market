// 가입 단계 진행 상태. 페이지가 나뉘어 있어 "본인인증·약관을 거쳤나"를 다음 페이지가 알아야 한다.
// TODO(백엔드 인증 구현 시): sessionStorage 대신 서버가 발급한 가입 세션 토큰으로 교체.
// 지금은 UI 단계라 브라우저 탭 안에서만 유지되면 충분 (탭 닫으면 처음부터).

const KEY = "signup:personal";

export interface PersonalSignupState {
  verificationToken?: string;
  termsAgreed?: boolean;
  marketingOptIn?: boolean;
}

function read(): PersonalSignupState {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PersonalSignupState) : {};
  } catch {
    return {};
  }
}

export const personalSignupFlow = {
  get: read,
  update(patch: PersonalSignupState) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ ...read(), ...patch }));
    } catch {
      // 시크릿 모드 등에서 막히면 다음 페이지 가드가 처음으로 돌려보낸다
    }
  },
  clear() {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      // 없어도 됨
    }
  },
};

export const personalSignupPath = {
  verify: "/signup/personal/verify",
  terms: "/signup/personal/terms",
  form: "/signup/personal/form",
  done: "/signup/done",
} as const;
