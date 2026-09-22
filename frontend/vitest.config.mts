import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// lib·hook 단위 테스트만. 컴포넌트 렌더 테스트가 필요해지면 그때 jsdom·testing-library 를 상의 후 추가
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
