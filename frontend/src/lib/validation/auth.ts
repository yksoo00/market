import { z } from "zod";
import { auth as t } from "@/messages/auth";

// 수치는 docs/security.md "입력 검증 > 계정" 이 원본. 백엔드 Bean Validation 과 같은 값.
const v = t.validation;

export const loginIdSchema = z
  .string()
  .min(1, v.required)
  .regex(/^[a-z][a-z0-9]{4,19}$/, v.loginId);

export const passwordSchema = z
  .string()
  .min(1, v.required)
  .min(10, v.password)
  .max(32, v.password)
  .regex(/[A-Za-z]/, v.password)
  .regex(/[0-9]/, v.password)
  .regex(/[^A-Za-z0-9]/, v.password);

export const bizNoSchema = z
  .string()
  .min(1, v.required)
  .transform((s) => s.replace(/-/g, "")) // 123-45-67890 처럼 붙여 넣어도 통과
  .pipe(z.string().regex(/^\d{10}$/, v.bizNo));

export const emailSchema = z.string().min(1, v.required).max(254, v.email).email(v.email);

// 로그인은 형식만 가볍게 (규칙 위반 계정은 어차피 서버가 거부). 비밀번호 규칙 노출 안 함
export const loginSchema = z.object({
  loginId: z.string().min(1, v.required),
  password: z.string().min(1, v.required),
  remember: z.boolean(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const businessLoginSchema = z.object({
  bizNo: bizNoSchema,
  password: z.string().min(1, v.required),
  remember: z.boolean(),
});
export type BusinessLoginInput = z.input<typeof businessLoginSchema>;
export type BusinessLoginOutput = z.output<typeof businessLoginSchema>;

// 일반 비밀번호 재설정: 아이디 + 본인인증 → 새 비밀번호. 아이디 포함 금지는 여기서 검사 (security.md "계정")
export const resetPasswordSchema = z
  .object({
    loginId: loginIdSchema,
    password: passwordSchema,
    passwordConfirm: z.string().min(1, v.required),
  })
  .refine((d) => !d.loginId || !d.password.toLowerCase().includes(d.loginId.toLowerCase()), {
    message: v.passwordHasId,
    path: ["password"],
  })
  .refine((d) => d.password === d.passwordConfirm, { message: v.passwordConfirm, path: ["passwordConfirm"] });
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;

// 기업 비밀번호 찾기: 사업자번호 + 담당자 이메일 → 링크 발송
export const findBusinessPasswordSchema = z.object({ bizNo: bizNoSchema, email: emailSchema });
export type FindBusinessPasswordInput = z.input<typeof findBusinessPasswordSchema>;

// 이메일 링크로 들어온 새 비밀번호 설정. 아이디를 모르는 화면이라 아이디 포함 검사는 서버만
export const newPasswordSchema = z
  .object({ password: passwordSchema, passwordConfirm: z.string().min(1, v.required) })
  .refine((d) => d.password === d.passwordConfirm, { message: v.passwordConfirm, path: ["passwordConfirm"] });
export type NewPasswordInput = z.input<typeof newPasswordSchema>;
