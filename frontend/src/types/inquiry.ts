// 문의 게시판 API 응답 (backend inquiry 패키지 DTO 와 1:1, 스펙 2026-11-18-inquiry-board-design.md)

export interface InquiryListItem {
  id: string;
  title: string;
  /** ISO-8601 UTC */
  createdAt: string;
  replyCount: number;
}

export interface InquiryPage {
  items: InquiryListItem[];
  /** 다음 페이지가 없으면 null */
  nextCursor: string | null;
}

export interface InquiryReply {
  id: string;
  content: string;
  createdAt: string;
}

export interface InquiryDetail {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  /** 오래된 순 */
  replies: InquiryReply[];
}
