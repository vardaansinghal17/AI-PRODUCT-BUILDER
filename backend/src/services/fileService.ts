import fs from "fs";
import path from "path";

export function writeFile(filename: string, code: string) {
  const baseDir = path.join(process.cwd(), "generated");

  const filePath = path.join(baseDir, filename);

  
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  fs.writeFileSync(filePath, code, "utf-8");

  console.log("File created:", filePath);
}