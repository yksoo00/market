// 데이터시트 PDF 안에 들어 있는 제품 사진(JPEG)을 꺼낸다. 제조사 사이트가 사진 내려받기를 막은 상품용 (fetch-product-files.mjs 보조).
//   node docs/demo/extract-pdf-photos.mjs --list r650,t350        후보를 --out 폴더에 저장하고 크기를 보여 준다
//   node docs/demo/extract-pdf-photos.mjs --take r650:2,t350:1    그 번호의 후보를 업로드 폴더에 넣고 manifest 에 적는다
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((a, c, i, all) => (c.startsWith("--") ? [...a, [c.slice(2), all[i + 1]]] : a), []));
const STORAGE = resolve(args.storage ?? join(here, "..", "..", "backend", "data", "uploads"));
const OUT = resolve(args.out ?? join(here, "assets", "_candidates"));
const MANIFEST = join(here, "assets", "manifest.json");
const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const now = new Date();
const YM = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;

function jpegs(buf) {
  const out = [];
  let i = 0;
  while ((i = buf.indexOf(Buffer.from([0xff, 0xd8, 0xff]), i)) !== -1) {
    const end = buf.indexOf(Buffer.from([0xff, 0xd9, 0x0a]), i + 3) !== -1 ? buf.indexOf(Buffer.from([0xff, 0xd9, 0x0a]), i + 3) : buf.indexOf(Buffer.from([0xff, 0xd9]), i + 3);
    if (end === -1) break;
    const data = buf.subarray(i, end + 2);
    // SOF 마커에서 크기
    let p = 2, w = 0, h = 0;
    while (p < data.length - 9) {
      if (data[p] !== 0xff) { p++; continue; }
      const m = data[p + 1];
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) { h = data.readUInt16BE(p + 5); w = data.readUInt16BE(p + 7); break; }
      p += 2 + data.readUInt16BE(p + 2);
    }
    if (w && h) out.push({ data, w, h });
    i = end + 2;
  }
  return out;
}
const cands = (k) => {
  const sheet = manifest[k]?.datasheet;
  if (!sheet || !existsSync(join(STORAGE, sheet))) return [];
  return jpegs(readFileSync(join(STORAGE, sheet)))
    .filter((c) => c.w >= 300 && c.h >= 200 && c.data.length >= 20_000 && c.data.length <= 5 * 1024 * 1024 && c.w / c.h > 0.4 && c.w / c.h < 3)
    .sort((a, b) => b.w * b.h - a.w * a.h)
    .slice(0, 6);
};
if (args.list) {
  mkdirSync(OUT, { recursive: true });
  for (const k of args.list.split(",")) {
    cands(k).forEach((c, n) => {
      writeFileSync(join(OUT, `${k}_${n + 1}.jpg`), c.data);
      console.log(`${k}_${n + 1}.jpg ${c.w}x${c.h} ${(c.data.length / 1024).toFixed(0)}KB`);
    });
  }
}
if (args.take) {
  for (const t of args.take.split(",")) {
    const [k, n] = t.split(":");
    const c = cands(k)[Number(n) - 1];
    if (!c) { console.log(`${k}: 후보 ${n} 없음`); continue; }
    const key = `public/listings/photos/${YM}/${randomUUID()}.jpg`;
    mkdirSync(dirname(join(STORAGE, key)), { recursive: true });
    writeFileSync(join(STORAGE, key), c.data);
    manifest[k].photo = key;
    manifest[k].photoSource = `데이터시트 PDF 안의 사진 (${manifest[k].datasheetSource})`;
    console.log(`${k}: ${key}`);
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
}
