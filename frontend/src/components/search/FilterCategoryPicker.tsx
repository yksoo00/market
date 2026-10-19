"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "cn";
import { loadTree } from "@/components/listing/CategoryPicker";
import { categoryPath, groupByDepth, type CategoryNode } from "@/lib/categories";
import { search } from "@/messages/search";

const t = search.filter;

/**
 * 검색 필터의 카테고리 (2026-10-19). 등록 폼 패널(CategoryPicker)과 같은 대 → 중 → 소 3열이지만,
 * 필터는 어느 단계에서 멈춰도 된다 — 대·중을 누르면 그 분류가 값이 되고(그 아래 전부), 소를 누르면 값이 되고 닫힌다.
 * 값은 부모 폼이 들고 있다 (적용을 눌러야 URL 에 반영).
 */
export function FilterCategoryPicker({ id, value, onChange }: { id: string; value: string; onChange: (code: string) => void }) {
  const [tree, setTree] = useState<CategoryNode[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    void loadTree().then((loaded) => {
      if (!live) return;
      if (loaded) setTree(loaded);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, []);

  // 패널 바깥을 누르면 닫는다
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const path = tree && value ? categoryPath(tree, value) : null;
  // 목록 전이거나 목록에 없는 코드면 코드를 그대로
  const shown = path ? path.map((n) => n.name).join(" > ") : value || t.categoryAll;
  const [large, mid] = [path?.[0] ?? null, path?.[1] ?? null];

  const pick = (node: CategoryNode, close = false) => {
    onChange(node.code);
    if (close) setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
      <button
        id={id}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        disabled={!tree}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "h-8.5 w-56 px-2.5 rounded-md border border-line bg-surface text-left text-sm outline-none focus-visible:border-primary disabled:text-ink-3",
          !value && "text-ink-2",
        )}
      >
        <span className="block truncate">{failed ? t.categoryLoadFailed : tree ? shown : t.categoryLoading}</span>
      </button>
      {open && tree && (
        <div className="absolute z-20 left-0 top-full mt-1 w-[36rem] max-w-[calc(100vw-2rem)] rounded-md border border-line bg-surface shadow-md">
          <div className="grid grid-cols-3 divide-x divide-line-2">
            <Column title={t.categoryLarge}>
              {groupByDepth(tree).map((g) => (
                <li key={g.depth}>
                  <p className="px-3 pt-2 pb-1 text-xs text-ink-3">{g.depth}</p>
                  <ul>
                    {g.nodes.map((n) => (
                      <Item key={n.code} node={n} active={large?.code === n.code} onClick={() => pick(n)} />
                    ))}
                  </ul>
                </li>
              ))}
            </Column>
            <Column title={t.categoryMid}>
              {large ? large.children.map((n) => <Item key={n.code} node={n} active={mid?.code === n.code} onClick={() => pick(n)} />) : <Hint>{t.categoryPickLarge}</Hint>}
            </Column>
            <Column title={t.categorySmall}>
              {mid ? (
                mid.children.map((n) => <Item key={n.code} node={n} active={value === n.code} onClick={() => pick(n, true)} />)
              ) : (
                <Hint>{large ? t.categoryPickMid : t.categoryPickLarge}</Hint>
              )}
            </Column>
          </div>
          <div className="flex justify-end border-t border-line-2 px-2 py-1.5">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="h-7 px-2 text-xs text-ink-2 hover:text-ink"
            >
              {t.categoryClear}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0 flex flex-col">
      <p className="px-3 py-2 text-xs font-bold text-ink-2 border-b border-line-2">{title}</p>
      <ul className="max-h-64 overflow-y-auto py-1">{children}</ul>
    </div>
  );
}

function Item({ node, active, onClick }: { node: CategoryNode; active: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={active}
        onClick={onClick}
        className={cn("w-full px-3 py-2 text-left text-sm wrap-break-word hover:bg-bg", active ? "bg-primary-soft text-primary font-medium" : "text-ink")}
      >
        {node.name}
      </button>
    </li>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <li className="px-3 py-2 text-xs text-ink-3">{children}</li>;
}
