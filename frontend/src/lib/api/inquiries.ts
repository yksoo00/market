import { api, post } from "@/lib/api/client";
import type { ApiResult } from "@/types/api";
import type { InquiryDetail, InquiryPage, InquiryReply } from "@/types/inquiry";

// 사내 테스트용 익명 문의 게시판 — 로그인 없이 부른다 (스펙 2026-11-18-inquiry-board-design.md)
const BASE = "/api/v1/inquiries";

export function fetchInquiries(cursor?: string): Promise<ApiResult<InquiryPage>> {
  return api(cursor ? `${BASE}?cursor=${encodeURIComponent(cursor)}` : BASE, { cache: "no-store" });
}

export function fetchInquiry(id: string): Promise<ApiResult<InquiryDetail>> {
  return api(`${BASE}/${encodeURIComponent(id)}`, { cache: "no-store" });
}

export function createInquiry(body: { title: string; content: string }): Promise<ApiResult<InquiryDetail>> {
  return post(BASE, body);
}

export function createInquiryReply(id: string, body: { content: string }): Promise<ApiResult<InquiryReply>> {
  return post(`${BASE}/${encodeURIComponent(id)}/replies`, body);
}
