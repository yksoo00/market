import { z } from "zod";
import { inquiry } from "@/messages/inquiry";

// 문의 게시판 입력 규칙. 수치는 백엔드 InquiryCreateRequest·InquiryReplyRequest 와 같다 (docs/security.md "입력 검증 > 문의 게시판").
// 길이는 자르지 않은 원문 .length(UTF-16 글자 수, 서버 String.length 와 같음)로 검사하고, 비었는지만 trim 으로 본다.
// 서버는 앞뒤 공백을 잘라 저장하지만 @Size 는 원문 기준이라, 여기서 trim 한 길이로 보면 서버가 거절하는 값을 통과시킨다.
const v = inquiry.validation;

export const INQUIRY_TITLE_MAX = 100;
export const INQUIRY_CONTENT_MAX = 2000;
export const INQUIRY_REPLY_MAX = 1000;

// NUL(U+0000)은 서버가 거절한다(Postgres 가 저장 못 함) — 같은 규칙을 즉시 알려 준다
const text = (required: string, max: number, tooLong: string) =>
  z
    .string()
    .refine((s) => s.trim().length > 0, required)
    .refine((s) => s.length <= max, tooLong)
    .refine((s) => !s.includes("\u0000"), v.forbiddenChar);

export const inquirySchema = z.object({
  title: text(v.titleRequired, INQUIRY_TITLE_MAX, v.titleMax),
  content: text(v.contentRequired, INQUIRY_CONTENT_MAX, v.contentMax),
});

export const inquiryReplySchema = z.object({
  content: text(v.replyRequired, INQUIRY_REPLY_MAX, v.replyMax),
});

export type InquiryFormValues = z.infer<typeof inquirySchema>;
export type InquiryReplyFormValues = z.infer<typeof inquiryReplySchema>;
