import fs from "fs";
import path from "path";

const GENERATED_DIR = path.resolve(__dirname, "../../generated");
const IGNORED_DIRECTORIES = new Set(["node_modules", "dist", ".git"]);

interface GeneratedPackageJson {
  name?: string;
  version?: string;
  private?: boolean;
  main?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function ensureGeneratedDir(): void {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
}

function resolveGeneratedPath(filename: string): string {
  const normalized = filename.replace(/^[./\\]+/, "").trim();
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

function collectProjectFiles(dir: string, files: string[]): void {
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    if (item.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(item.name)) {
        continue;
      }

      collectProjectFiles(path.join(dir, item.name), files);
      continue;
    }

    const fullPath = path.join(dir, item.name);

    try {
      const content = fs.readFileSync(fullPath, "utf-8");
      const relativePath = path.relative(GENERATED_DIR, fullPath).replace(/\\/g, "/");
      files.push(`FILE: ${relativePath}\n${content}`);
    } catch (error) {
      console.warn("Skipping unreadable generated file:", fullPath, error);
    }
  }
}

export function writeFile(filename: string, code: string): void {
  ensureGeneratedDir();

  const filePath = resolveGeneratedPath(filename);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, code, "utf-8");
}

export function getProjectContext(): string {
  if (!fs.existsSync(GENERATED_DIR)) {
    return "";
  }

  const files: string[] = [];
  collectProjectFiles(GENERATED_DIR, files);

  return files.sort().join("\n\n");
}

export function ensureGeneratedProjectScaffold(): void {
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
    fs.writeFileSync(entryPointPath, 'console.log("Generated app ready");\n', "utf-8");
  }
}
