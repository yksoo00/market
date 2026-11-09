"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { catalogApi } from "@/lib/api/catalog";
import { buildCategoryTree, categoryPath, groupByDepth, type CategoryNode } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { listing } from "@/messages/listing";

const t = listing.bulk.pick;

interface Props {
  /** 지금 줄의 카테고리 코드(소분류 경로). 있으면 그 대·중을 펼친 채 연다 */
  value: string;
  onPick: (code: string, name: string) => void;
  onClose: () => void;
}

/**
 * 다량 등록 줄에서 여는 카테고리 고르기 (계획 2026-11-06-bulk-listing-page.md). 등록 폼의 CategoryPicker 는 react-hook-form 에 묶여
 * 표 칸에서 쓸 수 없어 같은 목록 API·트리 함수로 따로 만든 독립 팝업. 소분류를 누르면 바로 정해지고 닫힌다
 */
export function CategoryPickDialog({ value, onPick, onClose }: Props) {
  const [tree, setTree] = useState<CategoryNode[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [large, setLarge] = useState<CategoryNode | null>(null);
  const [mid, setMid] = useState<CategoryNode | null>(null);

  useEffect(() => {
    let live = true;
    void catalogApi.categories().then((r) => {
      if (!live) return;
      if (!r.ok) {
        setFailed(true);
        return;
      }
      const built = buildCategoryTree(r.data);
      setTree(built);
      // 이미 고른 분류가 있으면 그 대·중을 펼친 채로 연다
      const path = value ? categoryPath(built, value) : null;
      setLarge(path?.[0] ?? null);
      setMid(path?.[1] ?? null);
    });
    return () => {
      live = false;
    };
  }, [value]);

  const choose = (small: CategoryNode) => {
    onPick(small.code, [large?.name, mid?.name, small.name].filter(Boolean).join(" > "));
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-3xl flex flex-col gap-3 [@media(max-height:640px)]:gap-2 [@media(max-height:640px)]:p-4">
        <div className="flex flex-col gap-1">
          <DialogTitle>{t.categoryTitle}</DialogTitle>
          <DialogDescription className="text-[13px]">{t.categoryDesc}</DialogDescription>
        </div>
        {failed && (
          <p role="alert" className="py-6 text-center text-[13px] text-down">
            {t.categoryFailed}
          </p>
        )}
        {!failed && tree === null && (
          <p role="status" aria-busy="true" className="py-6 text-center text-[13px] text-ink-2">
            {t.categoryLoading}
          </p>
        )}
        {tree && (
          <div className="grid max-h-[50vh] grid-cols-1 divide-y divide-line-2 overflow-y-auto rounded-md border border-line md:grid-cols-3 md:divide-x md:divide-y-0">
            <Column title={t.categoryLarge}>
              {groupByDepth(tree).map((g) => (
                <li key={g.depth}>
                  <p className="px-3 pt-2 pb-1 text-xs text-ink-3">{g.depth}</p>
                  <ul>
                    {g.nodes.map((n) => (
                      <Item
                        key={n.code}
                        node={n}
                        active={large?.code === n.code}
                        onClick={() => {
                          setLarge(n);
                          setMid(null);
                        }}
                      />
                    ))}
                  </ul>
                </li>
              ))}
            </Column>
            <Column title={t.categoryMid}>
              {large ? large.children.map((n) => <Item key={n.code} node={n} active={mid?.code === n.code} onClick={() => setMid(n)} />) : <Hint text={t.categoryPickLarge} />}
            </Column>
            <Column title={t.categorySmall}>
              {mid ? mid.children.map((n) => <Item key={n.code} node={n} active={n.code === value} onClick={() => choose(n)} />) : <Hint text={large ? t.categoryPickMid : t.categoryPickLarge} />}
            </Column>
          </div>
        )}
        <button type="button" onClick={onClose} className="h-10 rounded-md border border-line text-[14px] font-medium text-ink-2 hover:bg-bg">
          {t.cancel}
        </button>
      </DialogContent>
    </Dialog>
  );
}

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col">
      <p className="sticky top-0 border-b border-line-2 bg-bg px-3 py-1.5 text-[12px] font-semibold text-ink-2">{title}</p>
      <ul className="py-1">{children}</ul>
    </div>
  );
}

function Item({ node, active, onClick }: { node: CategoryNode; active: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active || undefined}
        className={cn("block w-full truncate px-3 py-1.5 text-left text-[13px] hover:bg-bg", active && "bg-primary-soft font-semibold text-primary")}
      >
        {node.name}
      </button>
    </li>
  );
}

function Hint({ text }: { text: string }) {
  return <li className="px-3 py-3 text-[12px] text-ink-3">{text}</li>;
}
