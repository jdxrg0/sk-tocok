/**
 * Browser-safe URL sanitizer to prevent javascript:, data:, vbscript:, and protocol-relative XSS links.
 */
export function sanitizeSafeUrl(
  rawUrl: string | null | undefined,
  options?: { allowRelative?: boolean; allowHttp?: boolean }
): string {
  if (!rawUrl || typeof rawUrl !== "string") return "#";
  const trimmed = rawUrl.trim();
  if (!trimmed || /[\x00-\x1F\x7F]/.test(trimmed)) return "#";

  const allowRelative = options?.allowRelative !== false;
  const allowHttp = options?.allowHttp === true;

  if (
    allowRelative &&
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !trimmed.startsWith("/\\")
  ) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:") return parsed.toString();
    if (allowHttp && parsed.protocol === "http:") return parsed.toString();
    return "#";
  } catch {
    return "#";
  }
}

export function sanitizeEmailHref(email: string | null | undefined): string {
  if (!email || typeof email !== "string") return "#";
  const clean = email.replace(/[\x00-\x1F\x7F?#\s]/g, "").trim();
  if (!clean || !clean.includes("@")) return "#";
  return `mailto:${clean}`;
}

export function sanitizePhoneHref(phone: string | null | undefined): string {
  if (!phone || typeof phone !== "string") return "#";
  const clean = phone.replace(/[^+\d()\-\s]/g, "").trim();
  if (!clean) return "#";
  return `tel:${clean}`;
}
