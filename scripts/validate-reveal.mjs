import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const html = await readFile("reveal.html", "utf8");
const required = ["<script type=\"module\" src=\"/src/main.js\"></script>", "id=\"app\"", "id=\"reader-container\"", "startup-shell", "#000000", "Doku-Doujin"];
const forbidden = ["<title>Maintenance</title>", "15gzfnndqaod1.jpeg", "background: #111"];
const failures = [];
for (const item of required) if (!html.includes(item)) failures.push(`Missing ${item}`);
for (const item of forbidden) if (html.includes(item)) failures.push(`Forbidden maintenance marker ${item}`);
const tmp = await mkdtemp(join(tmpdir(), "reveal-copy-"));
await writeFile(join(tmp, "index.html"), html);
const copied = await readFile(join(tmp, "index.html"), "utf8");
await rm(tmp, { recursive: true, force: true });
if (copied !== html) failures.push("reveal.html did not round-trip as an exact index.html copy");
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log("reveal.html canonical shell validated");
