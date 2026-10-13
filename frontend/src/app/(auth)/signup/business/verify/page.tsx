import { redirect } from "next/navigation";
import { businessSignupPath } from "@/lib/signupFlow";

// 사업자 인증 단계는 가입 폼 안의 [조회]로 합쳤다 (2026-10-13). 예전 주소는 가입 폼으로
export default function BusinessVerifyPage() {
  redirect(businessSignupPath.form);
}
