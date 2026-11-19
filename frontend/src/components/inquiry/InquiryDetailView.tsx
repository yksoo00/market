"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { InquiryForm } from "@/components/inquiry/InquiryForm";
import { InquiryReplyForm } from "@/components/inquiry/InquiryReplyForm";
import { deleteInquiry, deleteInquiryReply, fetchInquiry } from "@/lib/api/inquiries";
import { formatInquiryTime } from "@/lib/inquiryFormat";
import { common } from "@/messages/common";
import { inquiry as t } from "@/messages/inquiry";
import type { InquiryDetail, InquiryReply } from "@/types/inquiry";

type State = { kind: "loading" } | { kind: "notFound" } | { kind: "error" } | { kind: "deleted" } | { kind: "ready"; detail: InquiryDetail };

const actionClass = "text-xs font-medium text-ink-2 underline underline-offset-2 hover:text-ink";

/** 문의 한 건 + 답글 목록(오래된 순) + 답글 폼. 본문은 글자 그대로(HTML 로 해석하지 않는다). 수정·삭제 버튼은 서버가 준 canEdit·canDelete 대로 */
export function InquiryDetailView({ id }: { id: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [editingInquiry, setEditingInquiry] = useState(false);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchInquiry(id).then((result) => {
      if (!alive) return;
      if (result.ok) setState({ kind: "ready", detail: result.data });
      else setState({ kind: result.code === "NOT_FOUND" ? "notFound" : "error" });
    });
    return () => {
      alive = false;
    };
  }, [id, attempt]);

  function retry() {
    setState({ kind: "loading" });
    setAttempt((n) => n + 1);
  }

  function updateDetail(update: (d: InquiryDetail) => InquiryDetail) {
    setState((s) => (s.kind === "ready" ? { kind: "ready", detail: update(s.detail) } : s));
  }

  function onInquirySaved(saved: InquiryDetail) {
    setState({ kind: "ready", detail: saved });
    setEditingInquiry(false);
  }

  function onReplySaved(saved: InquiryReply) {
    updateDetail((d) => ({ ...d, replies: d.replies.some((r) => r.id === saved.id) ? d.replies.map((r) => (r.id === saved.id ? saved : r)) : [...d.replies, saved] }));
    setEditingReplyId(null);
  }

  async function removeInquiry() {
    if (!window.confirm(t.detail.confirmDelete)) return;
    setActionError(null);
    const result = await deleteInquiry(id);
    if (result.ok) setState({ kind: "deleted" });
    else setActionError(t.detail.deleteFailed);
  }

  async function removeReply(replyId: string) {
    if (!window.confirm(t.detail.confirmDeleteReply)) return;
    setActionError(null);
    const result = await deleteInquiryReply(id, replyId);
    if (result.ok) updateDetail((d) => ({ ...d, replies: d.replies.filter((r) => r.id !== replyId) }));
    else setActionError(t.detail.deleteFailed);
  }

  const back = (
    <Link href="/inquiries" className="text-[13px] text-ink-2 underline underline-offset-2">
      {t.detail.back}
    </Link>
  );

  if (state.kind === "loading") return <p className="px-1 text-[13px] text-ink-3">{t.detail.loading}</p>;

  if (state.kind === "notFound") {
    return (
      <div className="flex flex-col gap-3">
        <p role="alert" className="px-1 py-6 text-center text-[13px] text-ink-2">{t.detail.notFound}</p>
        {back}
      </div>
    );
  }

  if (state.kind === "deleted") {
    return (
      <div className="flex flex-col gap-3">
        <p role="status" className="px-1 py-6 text-center text-[13px] text-ink-2">{t.detail.deleted}</p>
        {back}
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="flex flex-col gap-3">
        <div role="alert" className="flex items-center gap-3 rounded-md border border-down/30 bg-down/5 px-3 py-2.5 text-[13px] text-down">
          <span className="grow">{t.detail.loadFailed}</span>
          <button type="button" onClick={retry} className="shrink-0 font-semibold underline underline-offset-2">
            {common.retry}
          </button>
        </div>
        {back}
      </div>
    );
  }

  const { detail } = state;
  return (
    <div className="flex flex-col gap-4">
      {back}
      {actionError && (
        <p role="alert" className="rounded-md border border-down/30 bg-down/5 px-3 py-2.5 text-[13px] text-down">
          {actionError}
        </p>
      )}

      {editingInquiry ? (
        <InquiryForm
          onSaved={onInquirySaved}
          editing={{ id: detail.id, title: detail.title, content: detail.content, onCancel: () => setEditingInquiry(false) }}
        />
      ) : (
        <article className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
          <h2 className="text-lg font-bold break-words">{detail.title}</h2>
          <p className="text-xs text-ink-3">{formatInquiryTime(detail.createdAt)}</p>
          <p className="whitespace-pre-wrap break-words text-[15px]">{detail.content}</p>
          {(detail.canEdit || detail.canDelete) && (
            <div className="flex gap-3 pt-1">
              {detail.canEdit && (
                <button type="button" onClick={() => setEditingInquiry(true)} className={actionClass}>
                  {t.detail.edit}
                </button>
              )}
              {detail.canDelete && (
                <button type="button" onClick={() => void removeInquiry()} className={actionClass}>
                  {t.detail.delete}
                </button>
              )}
            </div>
          )}
        </article>
      )}

      <section aria-label={t.detail.repliesHeading(detail.replies.length)} className="flex flex-col gap-3">
        <h3 className="px-1 text-[14px] font-bold">{t.detail.repliesHeading(detail.replies.length)}</h3>
        {detail.replies.length === 0 ? (
          <p className="px-1 text-[13px] text-ink-3">{t.detail.noReplies}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
            {detail.replies.map((reply) => (
              <li key={reply.id} className="flex flex-col gap-1 px-4 py-3">
                {editingReplyId === reply.id ? (
                  <InquiryReplyForm
                    inquiryId={detail.id}
                    onSaved={onReplySaved}
                    editing={{ replyId: reply.id, content: reply.content, onCancel: () => setEditingReplyId(null) }}
                  />
                ) : (
                  <>
                    <p className="whitespace-pre-wrap break-words text-[15px]">{reply.content}</p>
                    <p className="text-xs text-ink-3">{formatInquiryTime(reply.createdAt)}</p>
                    {(reply.canEdit || reply.canDelete) && (
                      <div className="flex gap-3 pt-1">
                        {reply.canEdit && (
                          <button type="button" onClick={() => setEditingReplyId(reply.id)} className={actionClass}>
                            {t.detail.edit}
                          </button>
                        )}
                        {reply.canDelete && (
                          <button type="button" onClick={() => void removeReply(reply.id)} className={actionClass}>
                            {t.detail.delete}
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <InquiryReplyForm inquiryId={detail.id} onSaved={onReplySaved} />
      </section>
    </div>
  );
}
