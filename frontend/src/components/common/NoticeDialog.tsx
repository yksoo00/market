"use client";

import { useState } from "react";
import { ResultDialog } from "@/components/common/ResultDialog";
import { common } from "@/messages/common";

export interface NoticeContent {
  tone: "success" | "error";
  title: string;
  message: string;
  /** 확인을 누른 뒤 이어서 할 일 (안내를 읽고 나서 모달을 여는 경우) */
  then?: () => void;
}

/** 클릭 뒤 안내를 모달로 띄우는 상태. show 를 부를 때마다 새로 열린다 */
export function useNotice() {
  const [notice, setNotice] = useState<(NoticeContent & { seq: number }) | null>(null);
  const show = (content: NoticeContent) => setNotice((prev) => ({ ...content, seq: (prev?.seq ?? 0) + 1 }));
  return { notice, show, close: () => setNotice(null) };
}

/** 구석 한 줄 대신 띄우는 안내 모달 (사용자 지시 2026-10-30). ResultDialog 에 [확인] 하나 */
export function NoticeDialog({ notice, onClose }: { notice: (NoticeContent & { seq: number }) | null; onClose: () => void }) {
  if (!notice) return null;
  const done = () => {
    onClose();
    notice.then?.();
  };
  return (
    <ResultDialog
      key={notice.seq}
      open
      tone={notice.tone}
      title={notice.title}
      message={notice.message}
      actionLabel={common.notice.confirm}
      onAction={done}
      onClose={done}
    />
  );
}
