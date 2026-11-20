"use client";

import { useEffect, useState } from "react";
import { DevTablePanel } from "@/components/dev/DevTablePanel";
import { ExcelPickButton } from "@/components/dev/ExcelPickButton";
import { NoticeDialog, useNotice } from "@/components/common/NoticeDialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { fetchDevTables, importDevAll } from "@/lib/api/dev";
import { dev } from "@/messages/dev";
import type { DevTable } from "@/types/dev";

/** 임시 테이블 관리: 테이블마다 탭 + 엑셀 전체 불러오기 (로컬 테스트용) */
export function DevTables() {
  const [tables, setTables] = useState<DevTable[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { notice, show, close } = useNotice();

  useEffect(() => {
    let alive = true;
    fetchDevTables().then((res) => {
      if (!alive) return;
      if (res.ok) setTables(res.data.tables);
      else setLoadError(res.message);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function importAll(file: File) {
    setBusy(true);
    const res = await importDevAll(file);
    setBusy(false);
    if (!res.ok) return show({ tone: "error", title: dev.result.importFailed, message: res.message });
    show({
      tone: "success",
      title: dev.result.importDone,
      message: res.data.results.map((r) => dev.result.importLine(r.table, r.inserted, r.keys)).join("\n"),
    });
  }

  if (loadError) {
    return (
      <p role="alert" className="text-[13px] text-down">
        {dev.loadFailed} {loadError}
      </p>
    );
  }
  if (!tables) return <p className="text-[13px] text-ink-2">{dev.loading}</p>;

  return (
    <div className="flex flex-col gap-3 bg-surface border border-line rounded-md p-4">
      <div className="flex">
        <ExcelPickButton
          label={dev.importAll}
          disabled={busy}
          onPick={importAll}
          onInvalid={(message) => show({ tone: "error", title: dev.result.pickFile, message })}
        />
      </div>
      <Tabs defaultValue={tables[0]?.name}>
        <div className="overflow-x-auto">
          <TabsList>
            {tables.map((t) => (
              <TabsTrigger key={t.name} value={t.name}>
                {t.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {tables.map((t) => (
          <TabsContent key={t.name} value={t.name} className="pt-3">
            <DevTablePanel table={t} notify={show} />
          </TabsContent>
        ))}
      </Tabs>
      <NoticeDialog notice={notice} onClose={close} />
    </div>
  );
}
