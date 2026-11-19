"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dev } from "@/messages/dev";
import type { DevCell, DevRow, DevTable } from "@/types/dev";

interface Props {
  table: DevTable;
  /** 수정이면 고른 행. PK 칸은 읽기 전용 */
  row: DevRow | null;
  /** 저장. 실패 사유 문구를 돌려주면 폼 위에 보인다(임시 화면이라 필드별이 아니라 한 곳) */
  onSubmit: (values: Record<string, DevCell>) => Promise<string | null>;
  onClose: () => void;
}

function text(cell: DevCell | undefined): string {
  return cell === null || cell === undefined ? "" : String(cell);
}

/** 컬럼마다 입력 칸. 빈 칸은 null 로 보낸다 */
export function DevRowForm({ table, row, onSubmit, onClose }: Props) {
  const editing = row !== null;
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(table.columns.map((c) => [c.name, text(row?.[c.name])])),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 새로 만들 때 DB 가 만들어 주는 uuid 키(uid)는 칸을 보이지 않는다 — 비워 두면 기본값(gen_random_uuid)이 들어간다
  const autoKey = (c: DevTable["columns"][number]) => !editing && c.type === "uuid" && c.hasDefault && table.primaryKey.includes(c.name);

  const missingRequired = table.columns.some(
    (c) => !c.nullable && !c.hasDefault && !(editing && table.primaryKey.includes(c.name)) && values[c.name].trim() === "",
  );

  async function submit() {
    setSaving(true);
    setError(null);
    const out: Record<string, DevCell> = {};
    for (const c of table.columns) {
      if (editing && table.primaryKey.includes(c.name)) continue;
      // 생성에서 빈 칸은 보내지 않는다 — DB 기본값이 있으면 그 값, 없으면 null
      if (values[c.name] === "") {
        if (editing) out[c.name] = null;
        continue;
      }
      out[c.name] = values[c.name];
    }
    const message = await onSubmit(out);
    setSaving(false);
    if (message) setError(message);
  }

  return (
    <Dialog open onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogTitle>{editing ? dev.form.updateTitle(table.name) : dev.form.createTitle(table.name)}</DialogTitle>
        <DialogDescription>{dev.form.hint}</DialogDescription>
        {error && (
          <p role="alert" className="mt-2 whitespace-pre-line break-all text-[13px] text-down">
            {error}
          </p>
        )}
        <div className="mt-3 flex flex-col gap-3">
          {table.columns.filter((c) => !autoKey(c)).map((c) => {
            const pk = table.primaryKey.includes(c.name);
            const readOnly = editing && pk;
            return (
              <div key={c.name} className="flex flex-col gap-1">
                <Label htmlFor={`dev-${c.name}`} className="text-[13px]">
                  {c.name} <span className="text-ink-2">({c.type})</span>
                  {!c.nullable && !c.hasDefault && <span className="text-down"> · {dev.form.required}</span>}
                  {readOnly && <span className="text-ink-2"> · {dev.form.pkReadonly}</span>}
                </Label>
                <Input
                  id={`dev-${c.name}`}
                  value={values[c.name]}
                  readOnly={readOnly}
                  onChange={(e) => setValues((prev) => ({ ...prev, [c.name]: e.target.value }))}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="button" variant="outline" className="flex-1" disabled={saving} onClick={onClose}>
            {dev.form.cancel}
          </Button>
          <Button type="button" className="flex-1" disabled={saving || missingRequired} onClick={submit}>
            {saving ? dev.form.saving : dev.form.submit}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
