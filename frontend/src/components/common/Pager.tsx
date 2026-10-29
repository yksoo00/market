import Link from "next/link";
import { pageItems } from "@/lib/pager";
import { common } from "@/messages/common";

interface Props {
  page: number;
  totalPages: number;
  /** 전체 건수 — 있으면 줄 앞에 "전체 N건" */
  total?: number;
  /** 그 번호 페이지의 주소 (검색어·필터 등 나머지 조건은 부르는 쪽이 유지한다) */
  hrefFor: (page: number) => string;
}

const t = common.pager;
const base = "min-w-8.5 h-8.5 px-2 inline-flex items-center justify-center rounded-md text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

/** 페이지 번호 줄 `‹ 1 2 3 … 10 ›` + 전체 건수 (설계 2026-10-27 PR 5). 한 페이지뿐이면 번호 줄은 그리지 않는다. 번호는 링크라 새로고침·뒤로가기에 그 페이지가 남는다 */
export function Pager({ page, totalPages, total, hrefFor }: Props) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label={t.label} className="flex flex-wrap items-center justify-center gap-1 pt-1">
      {total !== undefined && <span className="mr-2 text-[13px] text-ink-2">{t.total(total)}</span>}
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} aria-label={t.prev} className={`${base} text-ink-2 hover:bg-bg`}>
          ‹
        </Link>
      ) : (
        <span aria-hidden="true" className={`${base} text-ink-3 opacity-40`}>
          ‹
        </span>
      )}
      {pageItems(page, totalPages).map((item, i) =>
        item === "gap" ? (
          <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-ink-3">
            …
          </span>
        ) : (
          <Link
            key={item}
            href={hrefFor(item)}
            aria-label={t.go(item)}
            aria-current={item === page ? "page" : undefined}
            className={`${base} font-mono tabular-nums ${item === page ? "bg-primary-soft text-primary-dark font-bold" : "text-ink-2 hover:bg-bg"}`}
          >
            {item}
          </Link>
        ),
      )}
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} aria-label={t.next} className={`${base} text-ink-2 hover:bg-bg`}>
          ›
        </Link>
      ) : (
        <span aria-hidden="true" className={`${base} text-ink-3 opacity-40`}>
          ›
        </span>
      )}
    </nav>
  );
}
