import Link from "next/link";
import { my } from "@/messages/my";

const cards = [
  { href: "/my/activity", title: my.menu.myActivity, desc: my.hub.activityDesc },
  { href: "/my/history", title: my.menu.myHistory, desc: my.hub.historyDesc },
];

/** 마이페이지 바로가기. 항목이 늘면 카드를 더한다 */
export function MyHub() {
  return (
    <ul className="grid gap-3 @min-[36rem]:grid-cols-2">
      {cards.map((c) => (
        <li key={c.href}>
          <Link href={c.href} className="block rounded-md border border-line px-4 py-3.5 hover:border-primary hover:bg-bg">
            <span className="block text-[15px] font-bold text-ink">{c.title}</span>
            <span className="block mt-1 text-[13px] text-ink-2">{c.desc}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
