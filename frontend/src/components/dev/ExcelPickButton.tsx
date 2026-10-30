"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { dev } from "@/messages/dev";

const MAX_BYTES = 10 * 1024 * 1024;

/** 엑셀(.xlsx) 파일을 골라 넘긴다. 형식·크기는 고르는 즉시 검사 (백엔드도 같은 10MB) */
export function ExcelPickButton({
  label,
  disabled,
  onPick,
  onInvalid,
}: {
  label: string;
  disabled?: boolean;
  onPick: (file: File) => void;
  onInvalid: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".xlsx"
        className="hidden"
        aria-label={label}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          if (!file.name.toLowerCase().endsWith(".xlsx")) return onInvalid(dev.result.xlsxOnly);
          if (file.size > MAX_BYTES) return onInvalid(dev.result.tooLarge);
          onPick(file);
        }}
      />
      <Button type="button" variant="outline" disabled={disabled} onClick={() => input.current?.click()}>
        {label}
      </Button>
    </>
  );
}
