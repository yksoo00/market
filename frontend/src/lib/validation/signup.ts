import { z } from "zod";
import { joinAddress } from "@/lib/postcode";
import { emailSchema, loginIdSchema, passwordSchema } from "@/lib/validation/auth";
import { auth as ta } from "@/messages/auth";
import { emailDomains, phonePrefixes, signup as t } from "@/messages/signup";

// 수치는 docs/security.md "입력 검증 > 계정" 이 원본
const v = t.validation;

export const nameSchema = z
  .string()
  .min(1, ta.validation.required)
  .regex(/^[가-힣A-Za-z][가-힣A-Za-z ]{0,28}[가-힣A-Za-z]$/, v.name); // 2~30자, 영문 이름의 띄어쓰기 허용

export const nicknameSchema = z.string().min(1, ta.validation.required).min(2, v.nickname).max(20, v.nickname);

export const CUSTOM_DOMAIN = "custom";
const domainEnum = z.enum([...emailDomains, CUSTOM_DOMAIN]);
export type EmailDomainOption = z.infer<typeof domainEnum>;

/** 폼은 이메일을 앞부분 + 도메인으로 나눠 받고, 제출 시 joinEmail 로 합친다 */
export function joinEmail(local: string, domain: EmailDomainOption, custom: string): string {
  return `${local}@${domain === CUSTOM_DOMAIN ? custom : domain}`;
}

/** 필수 약관 동의. 서버도 @AssertTrue 로 다시 본다 */
export const agreeSchema = z.boolean().refine((agreed) => agreed, v.agree);

/** 주소 + 상세주소를 한 칸(users.user_address 200자)에 합쳐 저장하므로 합친 길이를 본다 */
export function addressTotalIssue(d: { address: string; addressDetail: string }, ctx: z.RefinementCtx) {
  if (joinAddress(d.address, d.addressDetail).length > 200) {
    ctx.addIssue({ code: "custom", path: ["addressDetail"], message: v.addressTotal });
  }
}

export const personalSignupSchema = z
  .object({
    name: nameSchema,
    nickname: z.string().max(20, v.nickname),
    nicknameUsage: z.enum(["Y", "N"]),
    loginId: loginIdSchema,
    emailLocal: z.string().min(1, v.emailLocal).max(64, v.emailLocal),
    emailDomain: domainEnum,
    emailCustom: z.string(),
    password: passwordSchema,
    passwordConfirm: z.string().min(1, ta.validation.required),
    phonePrefix: z.enum(phonePrefixes),
    phoneMid: z.string().regex(/^\d{4}$/, v.phone),
    phoneLast: z.string().regex(/^\d{4}$/, v.phone),
    tel: z.string().max(20, "전화번호는 20자 이하입니다."),
    address: z.string().max(200, "주소는 200자 이하입니다."),
    addressDetail: z.string().max(100, v.addressTotal),
    contactMethod: z.enum(["1", "2", "3"]),
    agreeTerms: agreeSchema,
    agreePrivacy: agreeSchema,
  })
  .superRefine((d, ctx) => {
    addressTotalIssue(d, ctx);
    if (d.nicknameUsage === "Y" && !nicknameSchema.safeParse(d.nickname).success) {
      ctx.addIssue({ code: "custom", path: ["nickname"], message: v.nickname });
    }
    if (d.emailDomain === CUSTOM_DOMAIN && d.emailCustom.trim() === "") {
      ctx.addIssue({ code: "custom", path: ["emailCustom"], message: v.emailDomain });
    } else {
      const email = joinEmail(d.emailLocal, d.emailDomain, d.emailCustom);
      if (email.length > 100) {
        ctx.addIssue({ code: "custom", path: [d.emailDomain === CUSTOM_DOMAIN ? "emailCustom" : "emailLocal"], message: "이메일은 100자 이하로 입력하세요." });
        return;
      }
      const r = emailSchema.safeParse(email);
      if (!r.success) {
        // 합친 결과가 틀리면 사용자가 고칠 수 있는 칸에 표시
        const path = d.emailDomain === CUSTOM_DOMAIN ? "emailCustom" : "emailLocal";
        ctx.addIssue({ code: "custom", path: [path], message: ta.validation.email });
      }
    }
    // 빈 아이디는 includes("") 가 항상 true 라 제외
    if (d.loginId && d.password.toLowerCase().includes(d.loginId.toLowerCase())) {
      ctx.addIssue({ code: "custom", path: ["password"], message: ta.validation.passwordHasId });
    }
    if (d.password !== d.passwordConfirm) {
      ctx.addIssue({ code: "custom", path: ["passwordConfirm"], message: ta.validation.passwordConfirm });
    }
  });

export type PersonalSignupInput = z.input<typeof personalSignupSchema>;
