"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { signup as t } from "@/messages/signup";
import type { TermsItem } from "@/messages/terms";

interface Props {
  items: TermsItem[];
  /** 동의 후 어디로. 선택 항목 동의 여부를 넘긴다 */
  onAgree: (optional: Record<string, boolean>) => string;
}

export function TermsForm({ items, onAgree }: Props) {
  const router = useRouter();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<string | null>(null);

  const allChecked = items.every((i) => checked[i.id]);
  const requiredOk = items.filter((i) => i.required).every((i) => checked[i.id]);

  function setAll(v: boolean) {
    setChecked(Object.fromEntries(items.map((i) => [i.id, v])));
  }

  function next() {
    const optional = Object.fromEntries(items.filter((i) => !i.required).map((i) => [i.id, Boolean(checked[i.id])]));
    router.push(onAgree(optional));
  }

  return (
    <div className="flex flex-col gap-4">
      <Label className="h-11 px-3 rounded-md bg-bg gap-2.5 text-[15px] font-bold cursor-pointer">
        <Checkbox checked={allChecked} onCheckedChange={(v) => setAll(v === true)} />
        {t.terms.all}
      </Label>

      <ul className="flex flex-col divide-y divide-line-2 border-y border-line-2">
        {items.map((item) => {
          const isOpen = open === item.id;
          return (
            <li key={item.id} className="flex flex-col">
              <div className="flex items-center gap-2.5 min-h-11 py-1">
                <Checkbox
                  id={`terms-${item.id}`}
                  checked={Boolean(checked[item.id])}
                  onCheckedChange={(v) => setChecked((c) => ({ ...c, [item.id]: v === true }))}
                />
                <Label htmlFor={`terms-${item.id}`} className="grow gap-1.5 text-[14px] font-normal cursor-pointer">
                  <span className={cn("text-xs font-semibold", item.required ? "text-primary" : "text-ink-3")}>
                    [{item.required ? t.terms.required : t.terms.optional}]
                  </span>
                  {item.title}
                </Label>
                {item.body && (
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : item.id)}
                    aria-expanded={isOpen}
                    aria-controls={`terms-body-${item.id}`}
                    className="flex items-center gap-0.5 px-1 h-8 text-xs text-ink-2 hover:text-primary"
                  >
                    {isOpen ? t.terms.close : t.terms.view}
                    <ChevronDown size={14} className={cn("transition-transform", isOpen && "rotate-180")} />
                  </button>
                )}
              </div>
              {item.body && isOpen && (
                // 텍스트로만 렌더 (security.md: 마크다운·HTML 렌더 금지)
                <pre
                  id={`terms-body-${item.id}`}
                  className="mb-3 max-h-56 overflow-y-auto rounded-md border border-line bg-bg p-3 text-xs leading-relaxed whitespace-pre-wrap font-sans text-ink-2"
                >
                  {item.body}
                </pre>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-ink-3">{t.terms.draftNotice}</p>

      <Button type="button" onClick={next} disabled={!requiredOk} className="h-11 w-full text-[15px] font-bold">
        {t.terms.next}
      </Button>
    </div>
  );
}
