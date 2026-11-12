/** Nhỏ: định dạng ngày YYYY-MM-DD → dd/mm/yyyy (không phụ thuộc timezone máy build). */
export function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}

/** Năm phát hành. */
export function yearOf(iso: string | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 4);
}

/** Làm sạch giá trị để hiển thị chuỗi credits rỗng. */
export function nonEmpty(values: string[] | undefined | null): string[] {
  return Array.isArray(values) ? values.filter((v) => v && v.trim()) : [];
}
