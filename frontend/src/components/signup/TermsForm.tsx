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

interface ListProps {
  items: TermsItem[];
  checked: Record<string, boolean>;
  onChange: (checked: Record<string, boolean>) => void;
}

/** 전체 동의 + 항목 목록. 상태는 부모가 가짐 (약관만 있는 페이지와 약관+닉네임 페이지가 같이 씀) */
export function TermsList({ items, checked, onChange }: ListProps) {
  const [open, setOpen] = useState<string | null>(null);
  const allChecked = items.every((i) => checked[i.id]);

  return (
    <div className="flex flex-col gap-4">
      <Label className="h-11 px-3 rounded-md bg-bg gap-2.5 text-[15px] font-bold cursor-pointer">
        <Checkbox checked={allChecked} onCheckedChange={(v) => onChange(Object.fromEntries(items.map((i) => [i.id, v === true])))} />
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
                  onCheckedChange={(v) => onChange({ ...checked, [item.id]: v === true })}
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
    </div>
  );
}

export function requiredAgreed(items: TermsItem[], checked: Record<string, boolean>): boolean {
  return items.filter((i) => i.required).every((i) => checked[i.id]);
}

export function optionalAgreed(items: TermsItem[], checked: Record<string, boolean>): Record<string, boolean> {
  return Object.fromEntries(items.filter((i) => !i.required).map((i) => [i.id, Boolean(checked[i.id])]));
}

interface Props {
  items: TermsItem[];
  /** 동의 후 어디로. 선택 항목 동의 여부를 넘긴다 */
  onAgree: (optional: Record<string, boolean>) => string;
}

/** 약관만 있는 단계. 동의하고 다음 페이지로 */
export function TermsForm({ items, onAgree }: Props) {
  const router = useRouter();
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  return (
    <div className="flex flex-col gap-4">
      <TermsList items={items} checked={checked} onChange={setChecked} />
      <Button
        type="button"
        onClick={() => router.push(onAgree(optionalAgreed(items, checked)))}
        disabled={!requiredAgreed(items, checked)}
        className="h-11 w-full text-[15px] font-bold"
      >
        {t.terms.next}
      </Button>
    </div>
  );
}
