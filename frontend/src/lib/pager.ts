// 페이지 번호 줄 `‹ 1 2 3 … 10 ›` (설계 2026-10-27 PR 5). 처음·끝 페이지와 현재 앞뒤 2칸만 보이고 사이는 …

/** 보일 칸 순서. 숫자 = 페이지 번호, "gap" = … */
export function pageItems(page: number, totalPages: number): (number | "gap")[] {
  const keep = new Set([1, totalPages]);
  for (let p = page - 2; p <= page + 2; p++) if (p >= 1 && p <= totalPages) keep.add(p);
  const sorted = [...keep].sort((a, b) => a - b);
  const items: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    // 바로 다음 번호면 그냥 잇고, 한 칸만 비면 …보다 번호가 짧으니 번호를 보인다
    const prev = sorted[i - 1];
    if (prev !== undefined && p - prev === 2) items.push(prev + 1);
    else if (prev !== undefined && p - prev > 2) items.push("gap");
    items.push(p);
  });
  return items;
}
