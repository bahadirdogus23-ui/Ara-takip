import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // Next'in tsconfig'i JSX'i olduğu gibi bırakır; testlerde React'in otomatik JSX dönüşümü kullanılır
  oxc: { jsx: { runtime: "automatic" } },
  test: { include: ["tests/**/*.test.{ts,tsx}"], exclude: ["e2e/**", "node_modules/**"] },
});
