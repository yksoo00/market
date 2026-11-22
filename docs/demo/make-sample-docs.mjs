// 시연 매물에 붙일 "테스트 리포트"·"정품 확인서" 샘플 PDF 를 만든다 (Edge 를 화면 없이 돌려 HTML 을 PDF 로 저장).
//
//   node docs/demo/make-sample-docs.mjs                          assets/listings.json 의 매물마다 2개씩 → 업로드 폴더 + manifest
//   node docs/demo/make-sample-docs.mjs --live <폴더>              라이브 등록용 상품(DS1621+)의 두 문서를 그 폴더에
//
// 실제 검사 결과·인증서가 아니다. 모든 페이지 위·아래에 "시연용 가상 문서"를 박는다. 정품 확인서는 제조사 인증서를 흉내 내지 않고
// 판매자가 쓴 확인서 형식이다 (제조사 이름·로고를 쓰지 않는다).
// 키: private/listings/test-reports|certificates/yyyy/MM/<uuid>.pdf (POST /api/v1/uploads 가 만드는 것과 같은 형식)

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((a, c, i, all) => (c.startsWith("--") ? [...a, [c.slice(2), all[i + 1]?.startsWith("--") || all[i + 1] === undefined ? "1" : all[i + 1]]] : a), []));
const STORAGE = resolve(args.storage ?? join(here, "..", "..", "backend", "data", "uploads"));
const MANIFEST = join(here, "assets", "manifest.json");
const EDGE = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find(existsSync);
if (!EDGE) throw new Error("Edge/Chrome 를 못 찾았습니다.");
const now = new Date();
const YM = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n) => fmt(new Date(now.getTime() - n * 86_400_000));

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** 상품 종류별 점검 항목 (결과는 전부 "합격" — 수치를 지어내지 않는다) */
function checks(cat, name) {
  const g = cat.slice(0, 3);
  if (cat.startsWith("E04") || /스위치|AP|방화벽/.test(name)) return ["외관(스크래치·변형)", "전원 투입·부팅", "전 포트 링크 점검", "PoE 급전 점검(해당 모델)", "펌웨어 확인·설정 초기화", "2시간 연속 가동"];
  if (g === "P02" || cat.startsWith("E05-F20")) return ["외관", "인식(BIOS·OS)", "SMART 상태 점검", "읽기·쓰기 검증", "섹터 오류 검사", "2시간 연속 부하"];
  if (g === "E01" || g === "E06") return ["외관(스크래치·찍힘)", "전원 투입·부팅", "디스플레이·키보드 점검", "배터리·충전 점검", "입출력 포트 점검", "저장장치 SMART 점검"];
  if (g === "P04") return ["외관", "무선 연결(블루투스·수신기)", "버튼·휠 동작", "충전·배터리", "센서 동작"];
  if (cat.startsWith("E05-F21")) return ["외관", "슬롯 장착·인식", "화면 출력(전 포트)", "그래픽 부하 시험", "팬·온도 점검"];
  return ["외관(스크래치·변형)", "전원 투입·POST", "펌웨어·BIOS 초기화", "디스크·메모리 인식", "RAID·네트워크 점검", "2시간 연속 부하"];
}

const css = `
@page { size: A4; margin: 16mm 16mm 18mm 16mm; }
* { box-sizing: border-box; }
body { font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; color: #1c2430; font-size: 12.5px; line-height: 1.6; margin: 0; }
.ribbon { border: 2px solid #c0392b; color: #c0392b; font-weight: 700; text-align: center; padding: 6px 0; border-radius: 6px; letter-spacing: 1px; margin-bottom: 18px; }
h1 { font-size: 26px; margin: 0 0 4px; letter-spacing: 2px; }
.sub { color: #5b6573; margin-bottom: 18px; }
table { width: 100%; border-collapse: collapse; margin: 10px 0 18px; }
th, td { border: 1px solid #c9d1db; padding: 8px 10px; text-align: left; vertical-align: top; }
th { background: #eef2f7; width: 26%; font-weight: 700; }
.items th { width: auto; text-align: center; }
.items td:last-child, .items th:last-child { width: 18%; text-align: center; }
.ok { color: #1e8449; font-weight: 700; }
.verdict { border: 2px solid #1e8449; color: #1e8449; font-size: 18px; font-weight: 700; text-align: center; padding: 10px; border-radius: 8px; margin: 18px 0; }
.sign { margin-top: 26px; display: flex; justify-content: flex-end; align-items: center; gap: 14px; }
.stamp { width: 74px; height: 74px; border: 2px solid #c0392b; color: #c0392b; border-radius: 50%; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 11px; font-weight: 700; transform: rotate(-8deg); }
.foot { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; color: #8a94a3; font-size: 10.5px; border-top: 1px solid #d9dfe7; padding-top: 6px; }
`;

function page(title, ribbon, body) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}</style></head><body>
<div class="ribbon">${esc(ribbon)}</div>${body}
<div class="foot">시연용 가상 문서 — 서비스 시연을 위해 만든 샘플이며 실제 검사·인증 결과가 아닙니다.</div></body></html>`;
}

function infoTable(d) {
  return `<table><tr><th>상품명</th><td>${esc(d.name)}</td></tr><tr><th>제조사</th><td>${esc(d.brand)}</td></tr><tr><th>파트넘버</th><td>${esc(d.part)}</td></tr>${d.state ? `<tr><th>상품상태</th><td>${esc(d.state)}</td></tr>` : ""}<tr><th>판매자</th><td>${esc(d.seller)}</td></tr></table>`;
}

export function testReportHtml(d) {
  const rows = checks(d.cat, d.name).map((c, i) => `<tr><td>${i + 1}. ${esc(c)}</td><td class="ok">합격</td></tr>`).join("");
  return page(
    `테스트 리포트 - ${d.name}`,
    "시연용 샘플 문서",
    `<h1>테스트 리포트</h1><div class="sub">출고 전 점검 결과 (가상)</div>${infoTable(d)}
<table><tr><th>점검일</th><td>${daysAgo(12)}</td></tr><tr><th>점검 담당</th><td>${esc(d.seller)} 품질관리 (가상)</td></tr><tr><th>관리번호</th><td>${esc(d.docNo)}</td></tr></table>
<table class="items"><tr><th>점검 항목</th><th>결과</th></tr>${rows}</table>
<div class="verdict">종합 판정 : 합격</div>
<div class="sign"><div>${esc(d.seller)}<br>점검일 ${daysAgo(12)}</div><div class="stamp">시연용<br>(인)</div></div>`,
  );
}

export function certificateHtml(d) {
  return page(
    `정품 확인서 - ${d.name}`,
    "시연용 샘플 문서",
    `<h1>정품 확인서</h1><div class="sub">판매자 확인 문서 (가상)</div>${infoTable(d)}
<table><tr><th>확인 일련번호</th><td>${esc(d.docNo)}</td></tr><tr><th>입고 경로</th><td>제조사 공식 유통 경로로 입고 (가상)</td></tr><tr><th>확인일</th><td>${daysAgo(13)}</td></tr></table>
<p style="margin:22px 0;font-size:14px">위 상품이 정품임을 판매자가 확인하며, 구매자가 요청하면 입고 증빙을 제공합니다. 정품이 아닌 것으로 밝혀지면 환불하거나 같은 모델로 교환합니다.</p>
<div class="sign"><div>${esc(d.seller)}<br>확인일 ${daysAgo(13)}</div><div class="stamp">시연용<br>(직인)</div></div>`,
  );
}

function toPdf(html, outFile) {
  const dir = mkdtempSync(join(tmpdir(), "market-doc-"));
  const htmlFile = join(dir, "doc.html");
  const pdf = join(dir, "doc.pdf");
  writeFileSync(htmlFile, html, "utf8");
  if (args.html) writeFileSync(args.html, html, "utf8"); // 모양 확인용: 마지막 문서의 HTML 을 이 경로에도 저장
  try {
    execFileSync(EDGE, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--no-first-run", `--user-data-dir=${join(dir, "profile")}`, `--print-to-pdf=${pdf}`, pathToFileURL(htmlFile).href], { timeout: 90_000, stdio: "ignore" });
  } catch {
    // Edge 가 PDF 를 쓰고도 비정상 종료 코드를 줄 때가 있어 파일이 생겼는지로 판단한다
  }
  if (!existsSync(pdf)) throw new Error("PDF 가 만들어지지 않았습니다: " + outFile);
  mkdirSync(dirname(outFile), { recursive: true });
  try {
    renameSync(pdf, outFile);
  } catch {
    writeFileSync(outFile, readFileSync(pdf));
  }
  rmSync(dir, { recursive: true, force: true });
}

const docNo = (id) => "DEMO-" + createHash("sha1").update(id).digest("hex").slice(0, 8).toUpperCase();

if (args.live) {
  const out = resolve(args.live);
  const d = { name: "DiskStation DS1621+ NAS 6베이", brand: "Synology", part: "DS1621+", cat: "E03-F10-G031", state: "신품대비 90~99%", seller: "한빛정보통신(주)", docNo: docNo("live:ds1621") };
  toPdf(testReportHtml(d), join(out, "03_테스트리포트_DS1621+.pdf"));
  toPdf(certificateHtml(d), join(out, "04_정품확인서_DS1621+.pdf"));
  console.log("라이브 등록용 문서 2개 →", out);
} else {
  const listings = JSON.parse(readFileSync(join(here, "assets", "listings.json"), "utf8"));
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const L = (manifest._listings ??= {});
  let made = 0;
  for (const l of listings) {
    const e = (L[l.id] ??= {});
    const d = { ...l, docNo: docNo(l.id) };
    if (!(e.testReport && existsSync(join(STORAGE, e.testReport))) || args.force) {
      const key = `private/listings/test-reports/${YM}/${randomUUID()}.pdf`;
      toPdf(testReportHtml(d), join(STORAGE, key));
      e.testReport = key;
      made++;
    }
    if (!(e.certificate && existsSync(join(STORAGE, e.certificate))) || args.force) {
      const key = `private/listings/certificates/${YM}/${randomUUID()}.pdf`;
      toPdf(certificateHtml(d), join(STORAGE, key));
      e.certificate = key;
      made++;
    }
    writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  }
  console.log(`문서 ${made}개 새로 만듦 (매물 ${listings.length}건)`);
}
