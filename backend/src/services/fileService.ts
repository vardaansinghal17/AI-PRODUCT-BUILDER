import fs from "fs";
import path from "path";

const GENERATED_DIR = path.resolve(__dirname, "../../generated");

interface GeneratedPackageJson {
  name?: string;
  version?: string;
  private?: boolean;
  main?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function ensureGeneratedDir() {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
}

function resolveGeneratedPath(filename: string): string {
  const normalized = filename.replace(/^[./\\]+/, "");
  const targetPath = path.resolve(GENERATED_DIR, normalized);

  if (!targetPath.startsWith(GENERATED_DIR)) {
    throw new Error(`Refusing to write outside generated directory: ${filename}`);
  }

  return targetPath;
}

function readJSONFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

export function writeFile(filename: string, code: string) {
  ensureGeneratedDir();

  const filePath = resolveGeneratedPath(filename);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, code, "utf-8");
  console.log(" File written:", filePath);
}

export function getProjectContext(): string {
  if (!fs.existsSync(GENERATED_DIR)) return "";

  const files: string[] = [];
  const ignoredDirectories = new Set(["node_modules", "dist", ".git"]);

  function readDir(dir: string) {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);

      if (fs.statSync(fullPath).isDirectory()) {
        if (ignoredDirectories.has(item)) {
          continue;
        }

        readDir(fullPath);
      } else {
        try {
          const content = fs.readFileSync(fullPath, "utf-8");

          files.push(`
FILE: ${path.relative(GENERATED_DIR, fullPath)}
${content}
          `);
        } catch (err) {
          console.log("Skipping unreadable file:", fullPath);
        }
      }
    }
  }

  readDir(GENERATED_DIR);

  return files.join("\n");
}

export function ensureGeneratedProjectScaffold() {
  ensureGeneratedDir();

  const packageJsonPath = path.join(GENERATED_DIR, "package.json");
  const tsconfigPath = path.join(GENERATED_DIR, "tsconfig.json");
  const entryPointPath = path.join(GENERATED_DIR, "src", "index.ts");

  const existingPackageJson =
    readJSONFile<GeneratedPackageJson>(packageJsonPath) ?? {};

  const packageJson: GeneratedPackageJson = {
    name: existingPackageJson.name || "generated-app",
    version: existingPackageJson.version || "1.0.0",
    private: existingPackageJson.private ?? true,
    main: existingPackageJson.main || "dist/index.js",
    scripts: {
      build: "tsc",
      start: "node dist/index.js",
      dev: "ts-node src/index.ts",
      ...(existingPackageJson.scripts ?? {}),
    },
    dependencies: {
      ...(existingPackageJson.dependencies ?? {}),
    },
    devDependencies: {
      typescript: "^5.9.3",
      "ts-node": "^10.9.2",
      "@types/node": "^25.5.0",
      ...(existingPackageJson.devDependencies ?? {}),
    },
  };

  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

  if (!fs.existsSync(tsconfigPath)) {
    const tsconfig = {
      compilerOptions: {
        target: "ES2020",
        module: "CommonJS",
        rootDir: "src",
        outDir: "dist",
        esModuleInterop: true,
        strict: true,
        skipLibCheck: true,
        moduleResolution: "node",
      },
      include: ["src"],
    };

    fs.writeFileSync(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`);
  }

  if (!fs.existsSync(entryPointPath)) {
    fs.mkdirSync(path.dirname(entryPointPath), { recursive: true });
    fs.writeFileSync(
      entryPointPath,
      'console.log("Generated app ready");\n',
      "utf-8"
    );
  }
}
