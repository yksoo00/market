"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "cn";
import { loadTree } from "@/components/listing/CategoryPicker";
import { categoryPath, groupByDepth, type CategoryNode } from "@/lib/categories";
import { search } from "@/messages/search";

const t = search.filter;

/** 카테고리 트리 (등록 폼과 같은 캐시). 아직이면 null, 실패면 "failed" */
export function useCategoryTree(): CategoryNode[] | null | "failed" {
  const [tree, setTree] = useState<CategoryNode[] | null | "failed">(null);
  useEffect(() => {
    let live = true;
    void loadTree().then((loaded) => {
      if (live) setTree(loaded ?? "failed");
    });
    return () => {
      live = false;
    };
  }, []);
  return tree;
}

/** 코드의 마지막 분류 이름 (칩에 보일 짧은 이름). 목록에 없으면 코드 그대로 */
export function categoryLabel(tree: CategoryNode[] | null | "failed", code: string): string {
  const path = Array.isArray(tree) ? categoryPath(tree, code) : null;
  return path ? path[path.length - 1].name : code;
}

/**
 * 검색 필터의 카테고리 패널 (2026-10-19). 등록 폼 패널(CategoryPicker)과 같은 대 → 중 → 소 3열이지만,
 * 필터는 어느 단계에서 멈춰도 된다 — 대·중을 누르면 그 분류가 값이 되고(그 아래 전부), 소를 누르면 onPickSmall.
 */
export function FilterCategoryPanel({
  tree,
  value,
  onChange,
  onPickSmall,
}: {
  tree: CategoryNode[];
  value: string;
  onChange: (code: string) => void;
  onPickSmall: (code: string) => void;
}) {
  const path = value ? categoryPath(tree, value) : null;
  const [large, mid] = [path?.[0] ?? null, path?.[1] ?? null];

  return (
    <div className="grid grid-cols-3 divide-x divide-line-2 rounded-md border border-line-2">
      <Column title={t.categoryLarge}>
        {groupByDepth(tree).map((g) => (
          <li key={g.depth}>
            <p className="px-3 pt-2 pb-1 text-xs text-ink-3">{g.depth}</p>
            <ul>
              {g.nodes.map((n) => (
                <Item key={n.code} node={n} active={large?.code === n.code} onClick={() => onChange(n.code)} />
              ))}
            </ul>
          </li>
        ))}
      </Column>
      <Column title={t.categoryMid}>
        {large ? large.children.map((n) => <Item key={n.code} node={n} active={mid?.code === n.code} onClick={() => onChange(n.code)} />) : <Hint>{t.categoryPickLarge}</Hint>}
      </Column>
      <Column title={t.categorySmall}>
        {mid ? (
          mid.children.map((n) => <Item key={n.code} node={n} active={value === n.code} onClick={() => onPickSmall(n.code)} />)
        ) : (
          <Hint>{large ? t.categoryPickMid : t.categoryPickLarge}</Hint>
        )}
      </Column>
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
