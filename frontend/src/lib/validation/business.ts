import { z } from "zod";
import { bizNoSchema, emailSchema, loginIdSchema, passwordSchema } from "@/lib/validation/auth";
import { addressTotalIssue, agreeSchema, CUSTOM_DOMAIN, joinEmail, nameSchema } from "@/lib/validation/signup";
import { auth as ta } from "@/messages/auth";
import { emailDomains, phonePrefixes, signup as t } from "@/messages/signup";

// 수치는 docs/security.md "입력 검증 > 계정" 이 원본
const v = t.business.validation;

const name50 = (msg: string) => z.string().min(1, ta.validation.required).min(2, msg).max(50, msg);

// 한 페이지 기업 가입 (2026-10-13). 사업자번호는 [조회]로 받은 토큰과 함께 쓰고(폼 밖 상태), 아이디·비밀번호로 로그인한다
export const businessSignupSchema = z
  .object({
    contactName: nameSchema,
    phonePrefix: z.enum(phonePrefixes),
    phoneMid: z.string().regex(/^\d{4}$/, t.validation.phone),
    phoneLast: z.string().regex(/^\d{4}$/, t.validation.phone),
    emailLocal: z.string().min(1, t.validation.emailLocal).max(64, t.validation.emailLocal),
    emailDomain: z.enum([...emailDomains, CUSTOM_DOMAIN]),
    emailCustom: z.string(),
    contactTel: z.string().max(20, "전화번호는 20자 이하입니다."),
    loginId: loginIdSchema,
    password: passwordSchema,
    passwordConfirm: z.string().min(1, ta.validation.required),
    bizNo: bizNoSchema,
    bizType: z.enum(["corporation", "individual"]),
    companyName: name50(v.companyName),
    companyTel: z.string().max(20, "회사 전화번호는 20자 이하입니다."),
    address: z.string().min(1, ta.validation.required).max(200, v.address),
    addressDetail: z.string().max(100, t.validation.addressTotal),
    agreeTerms: agreeSchema,
    agreePrivacy: agreeSchema,
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
    addressTotalIssue(d, ctx);
    // 비밀번호에 아이디·사업자번호 포함 금지 (security.md "계정", 백엔드 SignupService 와 같은 규칙)
    const lower = d.password.toLowerCase();
    if (d.loginId && lower.includes(d.loginId.toLowerCase())) {
      ctx.addIssue({ code: "custom", path: ["password"], message: ta.validation.passwordHasId });
    } else {
      const bizNo = d.bizNo.replace(/-/g, "");
      if (/^\d{10}$/.test(bizNo) && lower.includes(bizNo)) {
        ctx.addIssue({ code: "custom", path: ["password"], message: v.passwordHasBizNo });
      }
    }
    if (d.password !== d.passwordConfirm) {
      ctx.addIssue({ code: "custom", path: ["passwordConfirm"], message: ta.validation.passwordConfirm });
    }
  });

export type BusinessSignupInput = z.input<typeof businessSignupSchema>;
