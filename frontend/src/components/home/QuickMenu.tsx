import Link from "next/link";
import { Icon, type IconName } from "@/components/common/Icon";

const items: { icon: IconName; label: string; href: string; tone?: "green" }[] = [
  { icon: "sell", label: "판매하기", href: "/listings/new" },
  { icon: "buy", label: "구매요청 올리기", href: "/requests/new", tone: "green" },
  { icon: "quote", label: "견적서로 등록", href: "/listings/new/quote" },
  { icon: "category", label: "카테고리", href: "/categories" },
  { icon: "trend", label: "시세 조회", href: "/prices" },
  { icon: "chat", label: "채팅", href: "/chats" },
  { icon: "business", label: "사업자 등록", href: "/business/register" },
  { icon: "ai", label: "AI 어시스턴트", href: "/assistant" },
];

export function QuickMenu() {
  return (
    <nav aria-label="바로가기" className="grid grid-cols-4 gap-2 md:gap-3">
      {items.map(({ icon, label, href, tone }) => (
        <Link
          key={href}
          href={href}
          className="h-[66px] md:h-24 flex flex-col items-center justify-center gap-1.5 md:gap-2.5 rounded-[10px] bg-surface border border-line text-ink hover:border-primary"
        >
          <span
            className={`w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center ${
              tone === "green" ? "bg-green-soft text-green" : "bg-primary-soft text-primary"
            }`}
          >
            <Icon name={icon} />
          </span>
          <span className="text-[11px] md:text-[13px] font-medium">{label}</span>
        </Link>
      ))}
    </nav>
  );
}
