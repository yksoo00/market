import Link from "next/link";

interface Props {
  label: string;
  tabs: { key: string; label: string; href: string }[];
  current: string;
}

/** 내 활동내역·내 거래이력 위의 탭 줄. 링크라 칸 엔진이 같은 칸에서 이동시킨다 (검색 범위 탭과 같은 모양) */
export function MyTabs({ label, tabs, current }: Props) {
  return (
    <nav aria-label={label} className="self-start flex h-8.5 rounded-md border border-line bg-surface overflow-hidden">
      {tabs.map((tab, i) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={current === tab.key ? "page" : undefined}
          className={`px-3.5 flex items-center text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 ${
            current === tab.key ? "bg-primary-soft text-primary-dark font-medium" : "text-ink-2 hover:bg-bg"
          } ${i > 0 ? "border-l border-line" : ""}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
