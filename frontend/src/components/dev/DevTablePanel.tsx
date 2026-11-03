"use client";

import { useState } from "react";
import { DevRowForm } from "@/components/dev/DevRowForm";
import { ExcelPickButton } from "@/components/dev/ExcelPickButton";
import type { NoticeContent } from "@/components/common/NoticeDialog";
import { ResultDialog } from "@/components/common/ResultDialog";
import { Button } from "@/components/ui/button";
import { createDevRow, deleteDevRow, fetchDevRows, fetchRelatedDevRows, importDevTable, updateDevRow } from "@/lib/api/dev";
import { dev } from "@/messages/dev";
import type { DevCell, DevRow, DevRows, DevTable } from "@/types/dev";

const LIMIT = 100;

function keyOf(table: DevTable, row: DevRow): DevRow {
  return Object.fromEntries(table.primaryKey.map((k) => [k, row[k]]));
}

/** 테이블 하나의 조회·생성·수정·삭제·엑셀 불러오기 (임시 화면) */
export function DevTablePanel({ table, notify }: { table: DevTable; notify: (n: NoticeContent) => void }) {
  const [data, setData] = useState<DevRows | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [form, setForm] = useState<"create" | "update" | null>(null);
  // 삭제 확인창: 미리본 행의 키와 "같이 지워질 다른 테이블의 행 수". 키를 여기 붙들어 두어 확인한 그 행이 지워진다. null 이면 닫혀 있다
  const [pending, setPending] = useState<{ key: DevRow; related: Record<string, number> } | null>(null);

  const row = data !== null && selected !== null ? data.rows[selected] : null;

  async function query(offset = data?.offset ?? 0) {
    setBusy(true);
    const res = await fetchDevRows(table.name, LIMIT, offset);
    setBusy(false);
    if (!res.ok) return notify({ tone: "error", title: dev.result.queryFailed, message: res.message });
    setData(res.data);
    setSelected(null);
  }

  async function save(values: Record<string, DevCell>): Promise<string | null> {
    const res =
      form === "update" && row
        ? await updateDevRow(table.name, keyOf(table, row), values)
        : await createDevRow(table.name, values);
    if (!res.ok) return res.message;
    setForm(null);
    notify({ tone: "success", title: dev.result.saved, message: "" });
    await query();
    return null;
  }

  // [삭제]: 먼저 같이 지워질 다른 테이블의 행을 세어 확인창에 보여 준다
  async function askRemove() {
    if (!row) return;
    const key = keyOf(table, row);
    setBusy(true);
    const res = await fetchRelatedDevRows(table.name, key);
    setBusy(false);
    if (!res.ok) return notify({ tone: "error", title: dev.result.relatedFailed, message: res.message });
    setPending({ key, related: res.data.related });
  }

  async function remove() {
    if (!pending) return;
    const { key } = pending;
    setPending(null);
    setBusy(true);
    const res = await deleteDevRow(table.name, key);
    setBusy(false);
    if (!res.ok) return notify({ tone: "error", title: dev.result.deleteFailed, message: res.message });
    notify({
      tone: "success",
      title: dev.result.deleted,
      message: Object.entries(res.data.tables)
        .map(([name, n]) => dev.result.deletedLine(name, n))
        .join("\n"),
    });
    await query();
  }

  async function importFile(file: File) {
    setBusy(true);
    const res = await importDevTable(table.name, file);
    setBusy(false);
    if (!res.ok) return notify({ tone: "error", title: dev.result.importFailed, message: res.message });
    notify({
      tone: "success",
      title: dev.result.importDone,
      message: res.data.results.map((r) => dev.result.importLine(r.table, r.inserted)).join("\n"),
    });
    await query();
  }

  const invalid = (message: string) => notify({ tone: "error", title: dev.result.pickFile, message });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy} onClick={() => query(0)}>
          {dev.query}
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => setForm("create")}>
          {dev.create}
        </Button>
        <Button type="button" variant="outline" disabled={busy || !row} onClick={() => setForm("update")}>
          {dev.update}
        </Button>
        <Button type="button" variant="outline" disabled={busy || !row} onClick={() => void askRemove()}>
          {dev.remove}
        </Button>
        <ExcelPickButton label={dev.importTable} disabled={busy} onPick={importFile} onInvalid={invalid} />
      </div>

      {data === null ? (
        <p className="py-8 text-center text-[13px] text-ink-2">{dev.notQueried}</p>
      ) : data.rows.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-ink-2">{dev.empty}</p>
      ) : (
        <>
          <div className="flex items-center gap-2 text-[13px] text-ink-2">
            <span>{dev.pageRange(data.offset + 1, data.offset + data.rows.length, data.total)}</span>
            <Button type="button" variant="outline" size="sm" disabled={busy || data.offset === 0} onClick={() => query(Math.max(0, data.offset - LIMIT))}>
              {dev.prevPage}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={busy || data.offset + data.rows.length >= data.total} onClick={() => query(data.offset + LIMIT)}>
              {dev.nextPage}
            </Button>
          </div>
          <div className="overflow-auto max-h-[60dvh] border border-line rounded-md">
            <table className="text-[12px] whitespace-nowrap">
              <thead className="sticky top-0 bg-surface">
                <tr>
                  <th className="px-2 py-1 border-b border-line" />
                  {table.columns.map((c) => (
                    <th key={c.name} className="px-2 py-1 border-b border-line text-left font-medium">
                      {c.name}
                      {table.primaryKey.includes(c.name) && ` ${dev.pkMark}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r, i) => (
                  <tr key={i} className={selected === i ? "bg-line/40" : undefined} onClick={() => setSelected(i)}>
                    <td className="px-2 py-1">
                      <input type="radio" name={`sel-${table.name}`} checked={selected === i} onChange={() => setSelected(i)} aria-label={`${i + 1}`} />
                    </td>
                    {table.columns.map((c) => (
                      <td key={c.name} className="px-2 py-1 max-w-[260px] truncate" title={String(r[c.name] ?? "")}>
                        {r[c.name] === null ? <span className="text-ink-2">null</span> : String(r[c.name])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {form && (
        <DevRowForm
          table={table}
          row={form === "update" ? row : null}
          onSubmit={save}
          onClose={() => setForm(null)}
        />
      )}
      <ResultDialog
        open={pending !== null}
        tone="error"
        title={dev.confirmDelete.title}
        message={pending ? dev.confirmDelete.message(JSON.stringify(pending.key), pending.related) : ""}
        actionLabel={dev.confirmDelete.confirm}
        onAction={remove}
        retryLabel={dev.confirmDelete.cancel}
        onRetry={() => setPending(null)}
        onClose={() => setPending(null)}
      />
    </div>
  );
}
