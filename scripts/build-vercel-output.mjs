import { cpSync, mkdirSync, rmSync } from "node:fs";

rmSync("public", { recursive: true, force: true });
mkdirSync("public", { recursive: true });

for (const path of ["index.html", "styles.css", "assets", "dist"]) {
  cpSync(`frontend/${path}`, `public/${path}`, { recursive: true });
}
