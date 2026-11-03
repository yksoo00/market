"use client";

import { CircleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { NoticeDialog, useNotice } from "@/components/common/NoticeDialog";
import { ResultDialog } from "@/components/common/ResultDialog";
import { useTileOpen } from "@/components/common/TileWorkspaceContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cartApi } from "@/lib/api/cart";
import { COMPARE_HREF } from "@/lib/compare";
import { common } from "@/messages/common";
import { compare as t } from "@/messages/compare";
import { trade } from "@/messages/trade";

export interface CompareTarget {
  sellerId: string;
  regDate: string;
}

type Conflict = { reason: "full" | "category"; items: CompareTarget[] };

/**
 * [비교에 담기] 공용 (검색 목록·상세, 2026-11-03). 서버가 4개 초과·소분류 섞임을 거절하면 [비교 보기]·[비우고 새로 담기]·[취소] 모달,
 * 담기에 성공하면 "비교에 담았어요" + [비교 보기]. 모달·안내는 dialogs 를 화면에 그려 주면 뜬다.
 * onChanged = 목록이 바뀐 뒤(담음·교체) 화면이 다시 읽을 때
 */
export function useCompareAdd(onChanged?: () => void): { add: (items: CompareTarget[]) => Promise<void>; busy: boolean; dialogs: ReactNode } {
  const openTile = useTileOpen();
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [done, setDone] = useState<{ skipped: number } | null>(null);
  const { notice, show, close: closeNotice } = useNotice();

  const fail = (code: string, message: string) =>
    show({ tone: "error", title: common.notice.compareBlocked, message: trade.errors[code] ?? (message || t.failed) });

  const add = async (items: CompareTarget[]) => {
    setBusy(true);
    const res = await cartApi.addCompare(items);
    setBusy(false);
    if (res.ok) {
      setDone({ skipped: items.length - res.data.added });
      onChanged?.();
    } else if (res.code === "COMPARE_FULL") setConflict({ reason: "full", items });
    else if (res.code === "COMPARE_CATEGORY_MISMATCH") setConflict({ reason: "category", items });
    else fail(res.code, res.message);
  };

  const replace = async () => {
    if (!conflict) return;
    setBusy(true);
    const res = await cartApi.replaceCompare(conflict.items);
    setBusy(false);
    setConflict(null);
    if (res.ok) {
      setDone({ skipped: 0 });
      onChanged?.();
    } else fail(res.code, res.message);
  };

  const view = () => {
    setConflict(null);
    setDone(null);
    openTile(COMPARE_HREF, false);
  };

  const dialogs = (
    <>
      <NoticeDialog notice={notice} onClose={closeNotice} />
      <ResultDialog
        open={done !== null}
        tone="success"
        title={t.added.title}
        message={done && done.skipped > 0 ? `${t.added.skipped(done.skipped)}\n${t.added.message}` : t.added.message}
        actionLabel={t.added.view}
        onAction={view}
        onClose={() => setDone(null)}
      />
      <Dialog open={conflict !== null} onOpenChange={(next) => !next && !busy && setConflict(null)}>
        <DialogContent role="alertdialog" className="flex flex-col items-center gap-3 text-center">
          <CircleAlert size={44} className="text-down" aria-hidden="true" />
          <DialogTitle>{t.conflict.title}</DialogTitle>
          <DialogDescription>{conflict ? t.conflict[conflict.reason] : ""}</DialogDescription>
          <div className="mt-2 flex w-full flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setConflict(null)} className="h-11 flex-1 text-[15px] font-bold">
              {t.conflict.cancel}
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={view} className="h-11 flex-1 text-[15px] font-bold">
              {t.conflict.view}
            </Button>
            <Button type="button" disabled={busy} onClick={() => void replace()} autoFocus className="h-11 flex-1 text-[15px] font-bold">
              {t.conflict.replace}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );

  return { add, busy, dialogs };
}
