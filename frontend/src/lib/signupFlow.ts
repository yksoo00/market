// 가입 중인 사업자 인증 정보를 브라우저 탭에만 임시 보관한다.

export type PersonalSignupState = Record<never, never>;

export interface BusinessSignupState {
  /** 정보입력에서 인증 만료로 돌아왔을 때 인증 페이지가 보여줄 안내 */
  notice?: "VERIFICATION_EXPIRED";
  /** 사업자 인증 통과 결과. 정보입력 페이지에서 읽기 전용으로 보여줌 */
  business?: { bizNo: string; startDate: string; ownerName: string; verificationToken: string };
}

/** raw() 결과를 객체로. 깨진 값이면 빈 상태 (가드가 처음으로 돌려보냄) */
export function parseState<T extends object>(raw: string | null): T {
  try {
    return raw ? (JSON.parse(raw) as T) : ({} as T);
  } catch {
    return {} as T;
  }
}

function createFlow<T extends object>(key: string) {
  function read(): T {
    try {
      return parseState<T>(sessionStorage.getItem(key));
    } catch {
      return {} as T;
    }
  }
  return {
    get: read,
    /** useSyncExternalStore 스냅샷용. 문자열이라 내용이 같으면 같은 값 (객체는 매번 새로 만들어져 무한 렌더) */
    raw(): string | null {
      try {
        return sessionStorage.getItem(key);
      } catch {
        return null;
      }
    },
    update(patch: Partial<T>) {
      try {
        sessionStorage.setItem(key, JSON.stringify({ ...read(), ...patch }));
      } catch {
        // 시크릿 모드 등에서 막히면 다음 페이지 가드가 처음으로 돌려보낸다
      }
    },
    clear() {
      try {
        sessionStorage.removeItem(key);
      } catch {
        // 없어도 됨
      }
    },
  };
}

export const personalSignupFlow = createFlow<PersonalSignupState>("signup:personal");
export const businessSignupFlow = createFlow<BusinessSignupState>("signup:business");

export const personalSignupPath = {
  verify: "/signup/personal/form",
  terms: "/signup/personal/form",
  form: "/signup/personal/form",
  done: "/signup/done",
} as const;

export const businessSignupPath = {
  verify: "/signup/business/verify",
  form: "/signup/business/form",
  done: "/signup/done?type=business",
} as const;
