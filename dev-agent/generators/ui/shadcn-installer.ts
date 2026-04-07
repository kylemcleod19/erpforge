/**
 * ERP Forge Dev Agent — shadcn/ui Installer
 *
 * Initializes shadcn/ui and installs the required component set.
 * Rule-based — no AI calls.
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import type { GeneratorContext, GeneratedFile } from "../../types.js";
import { writePlatformFile } from "../../spec-manager.js";

/** Components required for the ERP platform shell */
const REQUIRED_COMPONENTS = [
  "button",
  "card",
  "input",
  "label",
  "form",
  "select",
  "table",
  "badge",
  "dialog",
  "dropdown-menu",
  "sidebar",
  "separator",
  "skeleton",
  "toast",
  "sonner",
  "avatar",
];

/**
 * Initializes shadcn/ui and installs required components.
 * Writes components.json and installs component files.
 *
 * @param ctx - Generator context with platform directory
 * @returns List of generated config files
 */
export function installShadcnUi(ctx: GeneratorContext): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const cwd = ctx.platformDir;

  // Write components.json config
  const componentsJson = buildComponentsJson();
  writePlatformFile(ctx.platformDir, "components.json", componentsJson.content);
  files.push(componentsJson);

  // Write lib/utils.ts (required by shadcn)
  const utils = buildLibUtils();
  writePlatformFile(ctx.platformDir, utils.relativePath, utils.content);
  files.push(utils);

  // Try to run shadcn init + add — skip if npm is not available or fails
  if (!fs.existsSync(path.join(cwd, "node_modules"))) {
    console.log("  ⚠  node_modules not found — skipping shadcn component installation.");
    console.log("     Run 'npm install' then 'npx shadcn@latest add button card ...' manually.");
    return files;
  }

  console.log("  Installing shadcn/ui components...");
  try {
    const componentList = REQUIRED_COMPONENTS.join(" ");
    execSync(`npx shadcn@latest add ${componentList} --yes`, {
      cwd,
      stdio: "inherit",
    });
    console.log("  ✓ shadcn/ui components installed");
  } catch (e) {
    console.warn("  ⚠  shadcn install failed — components will need to be installed manually:");
    console.warn(`     npx shadcn@latest add ${REQUIRED_COMPONENTS.join(" ")}`);
  }

  return files;
}

function buildComponentsJson(): GeneratedFile {
  const content = JSON.stringify(
    {
      $schema: "https://ui.shadcn.com/schema.json",
      style: "default",
      rsc: true,
      tsx: true,
      tailwind: {
        config: "tailwind.config.ts",
        css: "src/app/globals.css",
        baseColor: "slate",
        cssVariables: true,
        prefix: "",
      },
      aliases: {
        components: "@/components",
        utils: "@/lib/utils",
        ui: "@/components/ui",
        lib: "@/lib",
        hooks: "@/hooks",
      },
      iconLibrary: "lucide",
    },
    null,
    2
  );

  return {
    relativePath: "components.json",
    content,
    specIds: ["development_standards"],
    generator: "shadcn-installer",
  };
}

function buildLibUtils(): GeneratedFile {
  const content = `import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind CSS class names, resolving conflicts.
 * Required by shadcn/ui components.
 *
 * @param inputs - Class names to merge
 * @returns Merged class string
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`;

  return {
    relativePath: "src/lib/utils.ts",
    content,
    specIds: ["development_standards"],
    generator: "shadcn-installer",
  };
}
