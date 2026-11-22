// 직접 받은 사진 파일을 업로드 폴더에 넣고 manifest 에 적는다.
//   node docs/demo/add-local-photo.mjs <상품키> <파일> <출처 주소>
// (jpg·png·webp, 5MB 이하만. 형식은 파일 머리 바이트로 확인한다)
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const [k, file, source = ""] = process.argv.slice(2);
const buf = readFileSync(file);
const ext = buf[0] === 0xff && buf[1] === 0xd8 ? "jpg" : buf.subarray(1, 4).toString("latin1") === "PNG" ? "png" : buf.subarray(8, 12).toString("latin1") === "WEBP" ? "webp" : null;
if (!ext) throw new Error("jpg·png·webp 가 아님");
if (statSync(file).size > 5 * 1024 * 1024) throw new Error("5MB 초과");
const now = new Date();
const key = `public/listings/photos/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${randomUUID()}.${ext}`;
const abs = resolve(here, "..", "..", "backend", "data", "uploads", key);
mkdirSync(dirname(abs), { recursive: true });
copyFileSync(file, abs);
const mp = join(here, "assets", "manifest.json");
const m = JSON.parse(readFileSync(mp, "utf8"));
(m[k] ??= {}).photo = key;
m[k].photoSource = source;
writeFileSync(mp, JSON.stringify(m, null, 2) + "\n");
console.log(`${k}: ${key}`);
