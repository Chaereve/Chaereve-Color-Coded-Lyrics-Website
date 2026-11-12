/**
 * Kiểu hoá cho file cấu hình Decap CMS `admin/config.yml`.
 * File này chỉ phục vụ tooling/IDE (VD: import YAML vào TypeScript) —
 * không tham gia build của Astro.
 */
declare module '*/admin/config.yml' {
  const config: Record<string, unknown>;
  export default config;
}
