import { api, post } from "@/lib/api/client";
import type { ApiResult } from "@/types/api";
import type { InquiryDetail, InquiryPage, InquiryReply } from "@/types/inquiry";

// 사내 테스트용 문의 게시판 — 읽기는 로그인 없이, 쓰기·수정·삭제는 로그인 (스펙 2026-11-18-inquiry-board-design.md, 2026-11-19 수정·삭제)
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

export function updateInquiry(id: string, body: { title: string; content: string }): Promise<ApiResult<InquiryDetail>> {
  return api(`${BASE}/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) });
}

/** 글과 그 답글을 지운다 (본인 또는 관리자) → 204 */
export function deleteInquiry(id: string): Promise<ApiResult<null>> {
  return api(`${BASE}/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function updateInquiryReply(id: string, replyId: string, body: { content: string }): Promise<ApiResult<InquiryReply>> {
  return api(`${BASE}/${encodeURIComponent(id)}/replies/${encodeURIComponent(replyId)}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function deleteInquiryReply(id: string, replyId: string): Promise<ApiResult<null>> {
  return api(`${BASE}/${encodeURIComponent(id)}/replies/${encodeURIComponent(replyId)}`, { method: "DELETE" });
}
