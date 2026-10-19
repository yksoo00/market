"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { cn } from "cn";
import { FieldShell, statusClass, useFieldStatus } from "@/components/auth/FormField";
import { catalogApi } from "@/lib/api/catalog";
import { buildCategoryTree, categoryPath, groupByDepth, type CategoryNode } from "@/lib/categories";
import type { ListingFormInput } from "@/lib/validation/listing";
import { listing } from "@/messages/listing";

const t = listing.form;

// 목록(239건)은 모든 사용자가 같아 화면을 다시 열어도 한 번만 받는다. 실패하면 비워 다음에 다시 받는다.
// 검색 필터의 카테고리 패널(FilterCategoryPicker)도 같은 캐시를 쓴다
let treeCache: Promise<CategoryNode[] | null> | null = null;
export function loadTree(): Promise<CategoryNode[] | null> {
  treeCache ??= catalogApi.categories().then((r) => {
    if (r.ok) return buildCategoryTree(r.data);
    treeCache = null;
    return null;
  });
  return treeCache;
}

/**
 * 카테고리 고르기 (사용자 지시 2026-10-19): 칸을 누르면 패널이 열리고 대 → 중 → 소 순서로 누른다.
 * 소분류를 눌러야 코드가 폼 칸 categoryCode 로 들어간다. 칸에는 "대 > 중 > 소" 경로가 보인다.
 * readOnly = 상품마스터를 골라 마스터 값이 채워진 상태 (경로만 보여 준다)
 */
export function CategoryPicker({ readOnly = false }: { readOnly?: boolean }) {
  const { register, setValue, control } = useFormContext<ListingFormInput>();
  const code = useWatch({ control, name: "categoryCode" });
  const fieldStatus = useFieldStatus<ListingFormInput>("categoryCode");
  // 잠긴 칸(마스터 값을 보여만 주는 칸)은 검증 표시를 하지 않는다
  const error = readOnly ? undefined : fieldStatus.error;
  const valid = readOnly ? false : fieldStatus.valid;
  const touched = readOnly ? false : fieldStatus.touched;
  const [tree, setTree] = useState<CategoryNode[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  // 패널에서 지금 펼친 대·중분류 (소분류를 누르기 전까지는 폼 값이 안 바뀐다)
  const [large, setLarge] = useState<CategoryNode | null>(null);
  const [mid, setMid] = useState<CategoryNode | null>(null);
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

  const selected = tree && code ? categoryPath(tree, code) : null;
  // 목록 전이거나 목록에 없는 코드면 코드를 그대로
  const shown = selected ? selected.map((n) => n.name).join(" > ") : code;

  const close = () => {
    setOpen(false);
    // 아무것도 안 고르고 닫아도 필수 오류가 보이게 touched 로
    setValue("categoryCode", code, { shouldValidate: true, shouldTouch: true });
  };

  // 패널 바깥을 누르면 닫는다
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  });

  const toggle = () => {
    if (readOnly || !tree) return;
    if (open) return close();
    // 이미 고른 분류가 있으면 그 대·중을 펼친 채로 연다
    setLarge(selected?.[0] ?? null);
    setMid(selected?.[1] ?? null);
    setOpen(true);
  };

  const choose = (small: CategoryNode) => {
    setValue("categoryCode", small.code, { shouldValidate: true, shouldDirty: true, shouldTouch: true });
    setOpen(false);
  };

  const status = failed ? t.categoryLoadFailed : tree === null ? t.categoryLoading : undefined;

  return (
    <FieldShell inline label={t.categoryCode} htmlFor="categoryPicker" error={error} note={status ? <span className="text-ink-3">{status}</span> : undefined}>
      {/* 폼 값은 이 숨은 칸이 들고 있다 (등록·서버 오류 표시용) */}
      <input type="hidden" {...register("categoryCode")} />
      <div ref={boxRef} className="relative" onKeyDown={(e) => e.key === "Escape" && open && close()}>
        <button
          id="categoryPicker"
          type="button"
          aria-haspopup="true"
          aria-expanded={open}
          aria-describedby={error ? "categoryPicker-error" : undefined}
          disabled={readOnly}
          onClick={toggle}
          className={cn(
            "w-full rounded-md border border-line text-left outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30",
            touched && error && "border-down",
            statusClass(valid),
            readOnly && "bg-bg cursor-default",
            !shown && "text-ink-3",
          )}
        >
          <span className="block truncate">{shown || t.categoryPlaceholder}</span>
        </button>
        {open && tree && (
          <div className="absolute z-20 left-0 right-0 top-full mt-1 grid grid-cols-3 divide-x divide-line-2 rounded-md border border-line bg-surface shadow-md">
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
              {large ? (
                large.children.map((n) => <Item key={n.code} node={n} active={mid?.code === n.code} onClick={() => setMid(n)} />)
              ) : (
                <Hint>{t.categoryPickLarge}</Hint>
              )}
            </Column>
            <Column title={t.categorySmall}>
              {mid ? (
                mid.children.map((n) => <Item key={n.code} node={n} active={n.code === code} onClick={() => choose(n)} />)
              ) : (
                <Hint>{large ? t.categoryPickMid : t.categoryPickLarge}</Hint>
              )}
            </Column>
          </div>
        )}
      </div>
    </FieldShell>
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
