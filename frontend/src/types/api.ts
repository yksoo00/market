// 백엔드 응답 형식. .claude/rules/backend.md "API" 와 1:1
export interface ApiOk<T> {
  ok: true;
  data: T;
}

export interface ApiFail {
  ok: false;
  code: string;
  message: string;
  /** 검증 실패(VALIDATION) 시 필드별 문구. 키는 요청 DTO 필드명 */
  fields?: Record<string, string>;
}

export type ApiResult<T> = ApiOk<T> | ApiFail;

/** 백엔드에 닿지 못했을 때(네트워크·5xx) lib/api 가 만드는 코드. 서버가 주는 코드가 아님 */
export const UNREACHABLE = "UNREACHABLE";
