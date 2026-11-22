// 시연 상품 마스터용 실제 제품 사진·데이터시트를 제조사 사이트에서 받아 서버 업로드 폴더에 넣는다.
//
//   node docs/demo/fetch-product-files.mjs [--storage backend/data/uploads] [--only r650,dl380] [--retry]
//
// 받은 파일은 <storage>/public/listings/photos/yyyy/MM/<uuid>.<ext>, <storage>/private/listings/datasheets/yyyy/MM/<uuid>.pdf 로
// 저장하고(키 형식 = POST /api/v1/uploads 가 만드는 것과 같다), 키·출처 주소는 docs/demo/assets/manifest.json 에 적는다.
// build-demo-data.mjs 가 그 키를 상품 마스터(prod_image, prod_data_sheet)와 매물(prod_photo_1, prod_data_sheet)에 넣는다.
//
// 저작권: 사진·데이터시트는 각 제조사의 것이다. backend/data/ 는 .gitignore 라 저장소에 올라가지 않고, manifest 에는 키와 출처 주소만 있다.
// 시연(내부 데모)용으로만 쓴다. 제조사 사이트가 막으면(403·429) 그 상품은 실패로 남고, 직접 받은 파일로 대신하려면 manifest 의 키에 맞춰 넣는다.

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, all) => (cur.startsWith("--") ? [...acc, [cur.slice(2), all[i + 1]?.startsWith("--") ? "1" : (all[i + 1] ?? "1")]] : acc), []),
);
const STORAGE = resolve(args.storage ?? join(here, "..", "..", "backend", "data", "uploads"));
const ONLY = args.only ? new Set(args.only.split(",")) : null;
const MANIFEST = join(here, "assets", "manifest.json");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const now = new Date();
const YM = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;

// k = build-demo-data.mjs 의 상품 키. sheet = 데이터시트 PDF 주소(공식), page = 사진을 뽑을 제품 페이지(og:image), image = 사진 직접 주소
const SRC = {
  r650: { sheet: "https://i.dell.com/sites/csdocuments/Product_Docs/en/poweredge-r650-spec-sheet.pdf", page: "https://www.dell.com/en-us/shop/ipovw/poweredge-r650" },
  dl380: { sheet: "https://www.hpe.com/psnow/doc/a50002553enw.pdf", page: "https://buy.hpe.com/za/en/servers/proliant-dl-servers/proliant-dl300-servers/proliant-dl380-server/hpe-proliant-dl380-gen10-plus-server/p/1013291298" },
  sr650: { sheet: "https://psref.lenovo.com/syspool/Sys/PDF/datasheet/SR650_DS_EN.pdf", page: "https://lenovopress.lenovo.com/lp1050-thinksystem-sr650-server" },
  r750: { sheet: "https://www.delltechnologies.com/asset/en-us/products/servers/technical-support/dell-emc-poweredge-r750-spec-sheet.pdf", page: "https://www.dell.com/en-us/shop/ipovw/poweredge-r750" },
  t350: { sheet: "https://i.dell.com/sites/csdocuments/product_docs/en/dell-emc-poweredge-t350-spec-sheet.pdf", page: "https://www.dell.com/en-us/shop/ipovw/poweredge-t350" },
  rdimm: { page: "https://semiconductor.samsung.com/dram/module/rdimm/m393a4k40eb3-cwe/" },
  ds1621: { sheet: "https://global.download.synology.com/download/Document/Hardware/DataSheet/DiskStation/21-year/DS1621+/enu/Synology_DS1621_Plus_Data_Sheet_enu.pdf", image: "https://www.synology.com/img/products/detail/DS1621plus/heading.png" },
  ironwolf: { sheet: "https://www.seagate.com/files/www-content/datasheets/pdfs/ironwolf-pro-20tb-DS1914-21-2206US-en_US.pdf", page: "https://www.seagate.com/products/nas-drives/ironwolf-pro-hard-drive/" },
  wdred: { sheet: "https://documents.westerndigital.com/content/dam/doc-library/en_us/assets/public/western-digital/product/internal-drives/wd-red-plus-hdd/data-sheet-western-digital-wd-red-plus-hdd.pdf", page: "https://www.westerndigital.com/en-gb/products/internal-drives/wd-red-plus-sata-3-5-hdd?sku=WD80EFZZ" },
  pm9a3: { sheet: "https://download.semiconductor.samsung.com/resources/data-sheet/Samsung_SSD_PM9A3_Data_Sheet_Rev1.0.pdf", page: "https://semiconductor.samsung.com/ssd/datacenter-ssd/pm9a3/mzql21t9hcjr-00a07/" },
  smt1500: { page: "https://www.se.com/uk/en/product/SMT1500IC/apc-smartups-line-interactive-1500va-tower-230v-8x-iec-c13-outlets-smartconnect-port+smartslot-avr-lcd/" },
  a4000: { sheet: "https://www.nvidia.com/content/dam/en-zz/Solutions/gtcs21/rtx-a4000/nvidia-rtx-a4000-datasheet.pdf", page: "https://www.nvidia.com/en-us/products/workstations/rtx-a4000/" },
  c2960x: { sheet: "https://www3-realm.cisco.com/en/US/prod/collateral/switches/ps5718/ps12995/data_sheet_c78-728232.pdf", page: "https://www.cisco.com/c/en/us/products/switches/catalyst-2960-x-series-switches/index.html" },
  c9200l: { sheet: "https://meraki-go.xgslb-v3.cisco.com/c/en/us/products/collateral/switches/catalyst-9200-series-switches/nb-06-cat9200-ser-data-sheet-cte-en.pdf", page: "https://www.cisco.com/c/en/us/products/switches/catalyst-9200-series-switches/index.html" },
  usw24: { sheet: "https://dl.ui.com/ds/usw-pro-24-poe_ds.pdf", page: "https://techspecs.ui.com/unifi/switching/usw-pro-24-poe" },
  u6pro: { sheet: "https://dl.ui.com/ds/u6-pro_ds.pdf", page: "https://techspecs.ui.com/unifi/wifi/u6-pro" },
  ap22: { sheet: "https://www.hpe.com/psnow/doc/PSN1012928284IEEN.pdf", page: "https://www.arubainstanton.com/" },
  fg60f: { sheet: "https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/pdf/fortigate-fortiwifi-60f-series.pdf", page: "https://www.fortinet.com/resources/data-sheets/fortigate-fortiwifi-60f-series" },
  pa220: { sheetPage: "https://www.paloaltonetworks.com/resources/datasheets/pa-220-specsheet", page: "https://www.paloaltonetworks.com/resources/datasheets/pa-220-specsheet" },
  t14: { sheet: "https://psref.lenovo.com/syspool/Sys/PDF/ThinkPad/ThinkPad_T14_Gen_3_Intel/ThinkPad_T14_Gen_3_Intel_Spec.pdf", page: "https://psref.lenovo.com/Detail/ThinkPad/ThinkPad_T14_Gen_3_Intel?M=21AH0082YA" },
  elite840: { sheet: "https://h20195.www2.hp.com/v2/GetPDF.aspx/c06965780.pdf" },
  lat5430: { sheet: "https://www.delltechnologies.com/asset/en-us/products/laptops-and-2-in-1s/technical-support/latitude-5x30-spec-sheet.pdf", page: "https://www.dell.com/en-us/shop/dell-laptops/latitude-5430-laptop/spd/latitude-5430-laptop/s115l5430usvp" },
  op7090: { sheet: "https://dl.dell.com/content/manual60216691-optiplex-7090-small-form-factor-setup-and-specifications.pdf?language=en-us&ps=true" },
  ed800: { sheet: "https://h10032.www1.hp.com/ctg/Manual/c05390710.pdf" },
  m720q: { sheet: "https://psref.lenovo.com/syspool/Sys/PDF/datasheet/ThinkCentre_M720_Tiny_datasheet_EN.pdf", page: "https://psref.lenovo.com/Detail/ThinkCentre/ThinkCentre_M720_Tiny?M=10T7001HUS" },
  lg27: { page: "https://www.lg.com/us/monitors/lg-27up850-w-uhd-monitor" },
  u2723: { sheet: "https://www.delltechnologies.com/asset/en-gb/products/electronics-and-accessories/technical-support/dell-ultrasharp-27-and-32-usbc-hub-monitors-u2723qe-u3223qe-datasheet.pdf", page: "https://www.dell.com/en-us/shop/dell-ultrasharp-27-4k-usb-c-hub-monitor-u2723qe/apd/210-bdpf/monitors-monitor-accessories" },
  p2422: { sheet: "https://dl.dell.com/manuals/all-products/esuprt_electronics_accessories/esuprt_electronics_accessories_monitor/esuprt_monitor_p_series/dell-p2422h-monitor_user's-guide_en-us.pdf" },
  s980: { sheet: "https://download.semiconductor.samsung.com/resources/data-sheet/Samsung-NVMe-SSD-980-PRO-Data-Sheet_Rev.2.1_230509_10129505081019.pdf", page: "https://www.samsung.com/uk/memory-storage/nvme-ssd/980-pro-pcle-4-0-nvme-m-2-ssd-1tb-mz-v8p1t0bw/" },
  s870: { sheet: "https://download.semiconductor.samsung.com/resources/data-sheet/Samsung_SSD_870_EVO_Data_Sheet_Rev1.1_230509.pdf", page: "https://www.samsung.com/ca/memory-storage/sata-ssd/870-evo-1tb-sata-3-2-5-ssd-mz-77e1t0b-am/" },
  mx500: { sheet: "https://content.crucial.com/content/dam/crucial/ssd-products/mx500/flyer/crucial-mx500-ssd-productflyer-en.pdf", page: "https://uk.crucial.com/ssd/mx500/ct1000mx500ssd1/ct12590538" },
  mxm3s: { sheet: "https://www.logitech.com/content/dam/logitech/en/business/pdf/mx-master-3s-business-wireless-mouse.pdf", page: "https://www.logitech.com/en-us/products/mice/mx-master-3s.html" },
};

const MAX_PHOTO = 5 * 1024 * 1024;
const MAX_PDF = 10 * 1024 * 1024;
const GENERIC = /logo|og-image|og_image|default|placeholder|global|favicon|sprite|share-image|social/i;

async function get(url, accept) {
  const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": UA, Accept: accept ?? "*/*", "Accept-Language": "en-US,en;q=0.9" }, signal: AbortSignal.timeout(45_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

const sniff = (buf) => {
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "jpg";
  if (buf.subarray(1, 4).toString("latin1") === "PNG") return "png";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  return null;
};

async function download(url, want, limit) {
  const res = await get(url, want === "pdf" ? "application/pdf" : "image/webp,image/png,image/jpeg,*/*");
  const buf = Buffer.from(await res.arrayBuffer());
  const type = sniff(buf);
  if (want === "pdf" ? type !== "pdf" : !["jpg", "png", "webp"].includes(type)) throw new Error(`형식이 ${want} 가 아님(${type ?? "알 수 없음"})`);
  if (buf.length > limit) throw new Error(`너무 큼 ${(buf.length / 1048576).toFixed(1)}MB`);
  if (want !== "pdf" && buf.length < 12_000) throw new Error(`너무 작음 ${buf.length}B`);
  return { buf, ext: type };
}

function pageHtml(url) {
  return execFileSync("curl", ["-sL", "-m", "40", "-A", UA, url], { maxBuffer: 64 * 1024 * 1024 }).toString("utf8");
}

function candidates(html, base) {
  const out = [];
  for (const m of html.matchAll(/"image"\s*:\s*\[?\s*"([^"]+)"/g)) out.push(m[1]);
  for (const re of [/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/gi, /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/gi, /<meta[^>]+name=["']twitter:image["'][^>]*content=["']([^"']+)["']/gi]) {
    for (const m of html.matchAll(re)) out.push(m[1]);
  }
  return [...new Set(out)].map((u) => new URL(u.replaceAll("&amp;", "&"), base).href).filter((u) => !GENERIC.test(u));
}

function put(rel, buf) {
  const abs = join(STORAGE, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, buf);
}

const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
const have = (key) => key && existsSync(join(STORAGE, key)) && statSync(join(STORAGE, key)).size > 0;
const report = [];

for (const [k, s] of Object.entries(SRC)) {
  if (ONLY && !ONLY.has(k)) continue;
  const m = (manifest[k] ??= {});
  const notes = [];
  // 데이터시트
  if (have(m.datasheet) && !args.retry) notes.push("시트 있음");
  else {
    try {
      let sheetUrl = s.sheet;
      if (!sheetUrl && s.sheetPage) {
        const html = pageHtml(s.sheetPage);
        const link = [...html.matchAll(/href=["']([^"']+\.pdf[^"']*)["']/gi)].map((x) => new URL(x[1].replaceAll("&amp;", "&"), s.sheetPage).href).find((u) => /pa-?220/i.test(u));
        if (!link) throw new Error("페이지에서 PDF 링크를 못 찾음");
        sheetUrl = link;
      }
      if (sheetUrl) {
        const { buf } = await download(sheetUrl, "pdf", MAX_PDF);
        const key = `private/listings/datasheets/${YM}/${randomUUID()}.pdf`;
        put(key, buf);
        m.datasheet = key;
        m.datasheetSource = sheetUrl;
        notes.push(`시트 OK ${(buf.length / 1024).toFixed(0)}KB`);
      }
    } catch (e) {
      notes.push(`시트 실패(${e.message})`);
    }
  }
  // 사진
  if (have(m.photo) && !args.retry) notes.push("사진 있음");
  else {
    try {
      let list = s.image ? [s.image] : [];
      if (!list.length && s.page) list = candidates(pageHtml(s.page), s.page);
      if (!list.length) throw new Error("사진 주소를 못 찾음");
      let done = false;
      let lastErr;
      for (const u of list.slice(0, 3)) {
        try {
          const { buf, ext } = await download(u, "image", MAX_PHOTO);
          const key = `public/listings/photos/${YM}/${randomUUID()}.${ext}`;
          put(key, buf);
          m.photo = key;
          m.photoSource = u;
          notes.push(`사진 OK ${(buf.length / 1024).toFixed(0)}KB ${ext}`);
          done = true;
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (!done) throw lastErr;
    } catch (e) {
      notes.push(`사진 실패(${e.message})`);
    }
  }
  report.push(`${k.padEnd(9)} ${notes.join(" | ")}`);
}

mkdirSync(dirname(MANIFEST), { recursive: true });
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
console.log(report.join("\n"));
