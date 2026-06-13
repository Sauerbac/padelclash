import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

/**
 * Module boundaries are lint-enforced, not merely conventional
 * (docs/architecture/module-structure.md, ADR-0008). CI fails on a violation,
 * so the two pure leaves of the app — `domain` and `ui` — stay pure.
 *
 *   app → { services, ui }      services → { domain, db }
 *   domain → nothing            ui → nothing (except next/image)
 *
 * Two mechanisms, belt and suspenders:
 *   - no-restricted-imports  → bans external packages (next, drizzle) by import string.
 *   - import/no-restricted-paths → bans cross-layer internal imports by resolved path,
 *     catching both `@/…` aliases and relative escapes.
 */
const eslintConfig = [
  // Lint source and tooling only. docs/ (incl. the frozen design-system origin
  // spec), features/, and the issue tracker are content, not code.
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "docs/**",
      "features/**",
      ".scratch/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // domain: the framework-free core. No next, no ORM, no other layer.
  {
    files: ["src/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["next", "next/*"],
              message:
                "domain is framework-free — no Next imports (ADR-0008, module-structure.md).",
            },
            {
              group: ["drizzle-orm", "drizzle-orm/*", "postgres"],
              message:
                "domain must not touch the database or ORM (ADR-0008). Persistence lives in services/db.",
            },
          ],
        },
      ],
    },
  },

  // ui: the presentational design-system leaf. View-model props only.
  {
    files: ["src/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          // Bare `next` as an exact path: a `next` *pattern* would exclude the
          // whole next/ tree (gitignore parent rule), defeating the next/image
          // re-include below.
          paths: [
            {
              name: "next",
              message:
                "ui is presentational — only next/image is allowed (module-structure.md).",
            },
          ],
          patterns: [
            {
              group: ["next/*", "!next/image"],
              message:
                "ui is presentational — only next/image is allowed (module-structure.md).",
            },
          ],
        },
      ],
    },
  },

  // Cross-layer fences by resolved path (alias + relative).
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            // domain depends on nothing else.
            { target: "./src/domain", from: "./src/services", message: "domain must not import services (module-structure.md)." },
            { target: "./src/domain", from: "./src/db", message: "domain must not import db (ADR-0008)." },
            { target: "./src/domain", from: "./src/ui", message: "domain must not import ui." },
            { target: "./src/domain", from: "./src/app", message: "domain must not import app." },
            // ui renders from props alone — knows no data layer and no domain.
            { target: "./src/ui", from: "./src/services", message: "ui must not import services (module-structure.md)." },
            { target: "./src/ui", from: "./src/db", message: "ui must not import db (module-structure.md)." },
            { target: "./src/ui", from: "./src/domain", message: "ui takes view-model props, never a domain entity (module-structure.md)." },
            { target: "./src/ui", from: "./src/app", message: "ui must not import app." },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
