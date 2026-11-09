import { buyBulk } from "@/messages/buyBulk";
import type { ListingTraits } from "@/types/cartBulk";

const t = buyBulk.trait;

/** 매물에 있는 서류·정보 이름 목록 (파일 키는 오지 않는다 — 있는지만) */
export function evidenceNames(traits: ListingTraits): string[] {
  return [
    traits.hasDataSheet && t.dataSheet,
    traits.hasPhoto && t.photo,
    traits.hasWarrantyCoverage && t.coverage,
    traits.hasTestReport && t.testReport,
    traits.hasCertificate && t.certificate,
  ].filter((name): name is string => typeof name === "string");
}

/** 매물 특성 한 줄: 상태 · 보증 · 서류 */
export function TraitsLine({ traits, className }: { traits: ListingTraits; className?: string }) {
  const evidence = evidenceNames(traits);
  return (
    <span className={className}>
      {t.state(traits.prodState)} · {t.warranty(traits.warrantyDays)} · {evidence.length > 0 ? `${t.evidence}: ${evidence.join("·")}` : t.evidenceNone}
    </span>
  );
}
