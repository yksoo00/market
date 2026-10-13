import { redirect } from "next/navigation";
import { personalSignupPath } from "@/lib/signupFlow";

// 유형 선택 화면은 없앴다. 유형은 로그인 화면의 개인·기업 탭에서 정해지고, 예전 /signup 링크는 일반 가입으로 보낸다.
export default function SignupPage() {
  redirect(personalSignupPath.form);
}
