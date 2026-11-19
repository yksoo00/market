"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { InquiryForm } from "@/components/inquiry/InquiryForm";
import { fetchInquiries } from "@/lib/api/inquiries";
import { formatInquiryTime } from "@/lib/inquiryFormat";
import { common } from "@/messages/common";
import { inquiry as t } from "@/messages/inquiry";
import type { InquiryDetail, InquiryListItem } from "@/types/inquiry";

type Status = "loading" | "ready" | "error";

/** 문의 목록(최신순, 더 보기는 커서) + 글쓰기 폼. 로그인 없이 쓰는 사내 테스트용 게시판 */
export function InquiryBoard() {
  const [items, setItems] = useState<InquiryListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // 불러오기 효과는 attempt 가 바뀔 때마다 다시 돈다 (재시도 버튼). ListingDetailView 와 같은 방식
  useEffect(() => {
    let alive = true;
    void fetchInquiries().then((result) => {
      if (!alive) return;
      if (!result.ok) {
        setStatus("error");
        return;
      }
      // 목록 응답이 느린 사이 방금 쓴 글이 이미 들어와 있을 수 있다 — 응답(작성 전 목록)이 그 글을 덮어 지우지 않게 앞에 남긴다
      setItems((prev) => [...prev.filter((p) => !result.data.items.some((n) => n.id === p.id)), ...result.data.items]);
      setNextCursor(result.data.nextCursor);
      setStatus("ready");
    });
    return () => {
      alive = false;
    };
  }, [attempt]);

  function retry() {
    setStatus("loading");
    setAttempt((n) => n + 1);
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setMoreFailed(false);
    const result = await fetchInquiries(nextCursor);
    setLoadingMore(false);
    if (!result.ok) {
      setMoreFailed(true);
      return;
    }
    setItems((prev) => [...prev, ...result.data.items.filter((n) => !prev.some((p) => p.id === n.id))]);
    setNextCursor(result.data.nextCursor);
  }

  function onCreated(created: InquiryDetail) {
    // 방금 쓴 글을 목록 맨 위에. 서버에서 다시 받지 않아도 같은 최신순이다
    setItems((prev) => [{ id: created.id, title: created.title, createdAt: created.createdAt, replyCount: 0 }, ...prev]);
  }

  return (
    <div className="flex flex-col gap-4">
      <InquiryForm onCreated={onCreated} />

      {status === "loading" && <p className="px-1 text-[13px] text-ink-3">{t.list.loading}</p>}

      {status === "error" && (
        <div role="alert" className="flex items-center gap-3 rounded-md border border-down/30 bg-down/5 px-3 py-2.5 text-[13px] text-down">
          <span className="grow">{t.list.loadFailed}</span>
          <button type="button" onClick={retry} className="shrink-0 font-semibold underline underline-offset-2">
            {common.retry}
          </button>
        </div>
      )}

      {status === "ready" && items.length === 0 && <p className="px-1 py-6 text-center text-[13px] text-ink-3">{t.list.empty}</p>}

      {items.length > 0 && (
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={`/inquiries/${item.id}`} className="flex flex-col gap-0.5 px-4 py-3 hover:bg-bg">
                <span className="text-[15px] font-medium break-words">{item.title}</span>
                <span className="text-xs text-ink-3">
                  {formatInquiryTime(item.createdAt)} · {t.list.replyCount(item.replyCount)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {status === "ready" && nextCursor && (
        <div className="flex flex-col items-center gap-2">
          {moreFailed && <p role="alert" className="text-xs text-down">{t.list.loadFailed}</p>}
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="h-10 px-5 rounded-lg border border-line bg-surface text-sm font-medium hover:bg-bg disabled:opacity-50"
          >
            {loadingMore ? t.list.moreLoading : t.list.more}
          </button>
        </div>
      )}
    </div>
  );
}
