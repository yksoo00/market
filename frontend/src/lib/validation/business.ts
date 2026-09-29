import { z } from "zod";
import { bizNoSchema, emailSchema, passwordSchema } from "@/lib/validation/auth";
import { CUSTOM_DOMAIN, joinEmail, nameSchema } from "@/lib/validation/signup";
import { auth as ta } from "@/messages/auth";
import { emailDomains, phonePrefixes, signup as t } from "@/messages/signup";

// 수치는 docs/security.md "입력 검증 > 계정" 이 원본
const v = t.business.validation;

/** YYYYMMDD, 실제 존재하는 날짜, 오늘 이전 */
export const startDateSchema = z
  .string()
  .min(1, ta.validation.required)
  .regex(/^\d{8}$/, v.startDate)
  .refine((s) => {
    const y = Number(s.slice(0, 4));
    const m = Number(s.slice(4, 6));
    const d = Number(s.slice(6, 8));
    const date = new Date(y, m - 1, d);
    const real = date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
    return real && date <= new Date();
  }, v.startDate);

const name50 = (msg: string) => z.string().min(1, ta.validation.required).min(2, msg).max(50, msg);

// 1단계: 사업자 인증. 국세청 진위확인 API 필수값 3개
export const businessVerifySchema = z.object({
  bizNo: bizNoSchema,
  startDate: startDateSchema,
  ownerName: name50(v.ownerName),
});
export type BusinessVerifyInput = z.input<typeof businessVerifySchema>;
export type BusinessVerifyOutput = z.output<typeof businessVerifySchema>;

// 2단계: 나머지 정보. 사업자번호·개업일·대표자는 1단계 결과를 그대로 씀 (폼 필드 아님)
export const businessSignupSchema = z
  .object({
    /** 인증 단계 결과. 화면엔 안 보이고 "비밀번호에 아이디(사업자번호) 포함 금지" 검사용 */
    bizNo: z.string(),
    password: passwordSchema,
    passwordConfirm: z.string().min(1, ta.validation.required),
    bizType: z.enum(["corporation", "individual"]),
    companyName: name50(v.companyName),
    address: z.string().min(1, ta.validation.required).max(200, v.address),
    contactName: nameSchema,
    phonePrefix: z.enum(phonePrefixes),
    phoneMid: z.string().regex(/^\d{4}$/, t.validation.phone),
    phoneLast: z.string().regex(/^\d{4}$/, t.validation.phone),
    contactTel: z.string().max(20, "전화번호는 20자 이하입니다."),
    companyTel: z.string().max(20, "회사 전화번호는 20자 이하입니다."),
    emailLocal: z.string().min(1, t.validation.emailLocal).max(64, t.validation.emailLocal),
    emailDomain: z.enum([...emailDomains, CUSTOM_DOMAIN]),
    emailCustom: z.string(),
  })
  .superRefine((d, ctx) => {
    if (d.emailDomain === CUSTOM_DOMAIN && d.emailCustom.trim() === "") {
      ctx.addIssue({ code: "custom", path: ["emailCustom"], message: t.validation.emailDomain });
    } else if (joinEmail(d.emailLocal, d.emailDomain, d.emailCustom).length > 100) {
      ctx.addIssue({ code: "custom", path: [d.emailDomain === CUSTOM_DOMAIN ? "emailCustom" : "emailLocal"], message: "이메일은 100자 이하로 입력하세요." });
    } else if (!emailSchema.safeParse(joinEmail(d.emailLocal, d.emailDomain, d.emailCustom)).success) {
      const path = d.emailDomain === CUSTOM_DOMAIN ? "emailCustom" : "emailLocal";
      ctx.addIssue({ code: "custom", path: [path], message: ta.validation.email });
    }
    // 기업 회원의 로그인 아이디는 사업자번호 (security.md "계정")
    if (d.bizNo && d.password.includes(d.bizNo)) {
      ctx.addIssue({ code: "custom", path: ["password"], message: ta.validation.passwordHasId });
    }
    if (d.password !== d.passwordConfirm) {
      ctx.addIssue({ code: "custom", path: ["passwordConfirm"], message: ta.validation.passwordConfirm });
    }
  });

export type BusinessSignupInput = z.input<typeof businessSignupSchema>;
