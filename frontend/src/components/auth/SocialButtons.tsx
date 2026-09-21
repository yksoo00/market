import { socialLoginUrl, type SocialProvider } from "@/lib/api/auth";
import { auth as t } from "@/messages/auth";

// 브랜드 마크. 각 사 가이드 색 (design.md "폼 페이지"). 선 아이콘 규칙의 예외
const marks: Record<SocialProvider, React.ReactNode> = {
  kakao: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="#000" d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.8 5.2 4.6 6.6l-1 3.8c-.1.3.3.6.6.4l4.4-2.9c.5.1.9.1 1.4.1 5.5 0 10-3.6 10-8S17.5 3 12 3z" />
    </svg>
  ),
  naver: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#fff" d="M4 4h5.2l5.6 8.4V4H20v16h-5.2L9.2 11.6V20H4z" />
    </svg>
  ),
  google: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.8z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.7-4.9H1.3v3.1C3.3 21.4 7.3 24 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3c-.5-1.5-.5-3.1 0-4.6V6.6H1.3c-1.7 3.4-1.7 7.4 0 10.8l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4C17.9 1.2 15.1 0 12 0 7.3 0 3.3 2.6 1.3 6.6l4 3.1c1-2.8 3.6-4.9 6.7-4.9z" />
    </svg>
  ),
};

const styles: Record<SocialProvider, string> = {
  kakao: "bg-[#FEE500] text-[#191919] hover:bg-[#F5DC00]",
  naver: "bg-[#03C75A] text-white hover:bg-[#02B351]",
  google: "bg-surface text-ink border border-line hover:bg-bg",
};

const order: SocialProvider[] = ["kakao", "naver", "google"];

export function SocialButtons({ next }: { next: string }) {
  return (
    <div className="flex flex-col gap-2">
      {order.map((p) => (
        <a
          key={p}
          href={socialLoginUrl(p, next)}
          className={`h-11 flex items-center justify-center gap-2.5 rounded-md text-[14px] font-semibold ${styles[p]}`}
        >
          {marks[p]}
          {t.login.social[p]}
        </a>
      ))}
    </div>
  );
}
