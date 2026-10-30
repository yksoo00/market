import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DevTables } from "@/components/dev/DevTables";
import { dev } from "@/messages/dev";

export const metadata: Metadata = { title: dev.page.title };

// 로컬 전용 임시 화면. NEXT_PUBLIC_DEV_TOOLS=true 가 아니면 없는 화면 (백엔드도 APP_ENV=local 이 아니면 404)
export default function DevTablesPage() {
  if (process.env.NEXT_PUBLIC_DEV_TOOLS !== "true") notFound();
  return (
    <main className="flex-1 min-h-0 overflow-y-auto px-4 @md:px-6 py-4 @md:py-6">
      <div className="w-full max-w-[1200px] mx-auto flex flex-col gap-4">
        <div className="flex flex-col gap-1 px-1">
          <h1 className="text-xl font-bold">{dev.page.title}</h1>
          <p className="text-[13px] text-ink-2">{dev.page.subtitle}</p>
        </div>
        <DevTables />
      </div>
    </main>
  );
}
