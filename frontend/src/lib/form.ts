import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { ApiFail } from "@/types/api";

/**
 * 서버 오류를 폼에 반영. rules/frontend.md "검증 반응":
 * fields 가 있으면 해당 필드에, 못 찾으면(또는 없으면) 폼 상단용 문구를 돌려준다.
 * codeMessages 로 서버 코드를 우리 문구로 바꿀 수 있음.
 */
export function applyServerError<T extends FieldValues>(
  fail: ApiFail,
  setError: UseFormSetError<T>,
  knownFields: readonly Path<T>[],
  codeMessages: Record<string, string> = {},
): string | null {
  let unmatched: string | null = null;
  for (const [name, message] of Object.entries(fail.fields ?? {})) {
    if ((knownFields as readonly string[]).includes(name)) {
      setError(name as Path<T>, { type: "server", message });
    } else {
      unmatched = message;
    }
  }
  if (fail.fields && Object.keys(fail.fields).length > 0) return unmatched;
  return codeMessages[fail.code] ?? fail.message;
}
