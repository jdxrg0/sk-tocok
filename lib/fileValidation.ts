import path from "path";

export type UploadPolicyCategory =
  | "avatar"
  | "attendance"
  | "financial_doc"
  | "cse_doc"
  | "print_doc";

interface UploadPolicy {
  maxBytes: number;
  maxLabel: string;
  allowedExtensions: readonly string[];
  allowedMimes: readonly string[];
}

export const UPLOAD_POLICIES: Record<UploadPolicyCategory, UploadPolicy> = {
  avatar: {
    maxBytes: 10 * 1024 * 1024,
    maxLabel: "10 MB",
    allowedExtensions: [".png", ".jpg", ".jpeg", ".webp", ".gif"],
    allowedMimes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  },
  attendance: {
    maxBytes: 15 * 1024 * 1024,
    maxLabel: "15 MB",
    allowedExtensions: [".png", ".jpg", ".jpeg", ".webp", ".gif", ".heic", ".heif"],
    allowedMimes: [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
      "image/heic",
      "image/heif",
    ],
  },
  financial_doc: {
    maxBytes: 10 * 1024 * 1024,
    maxLabel: "10 MB",
    allowedExtensions: [".png", ".jpg", ".jpeg", ".webp", ".pdf"],
    allowedMimes: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
  },
  cse_doc: {
    maxBytes: 10 * 1024 * 1024,
    maxLabel: "10 MB",
    allowedExtensions: [".png", ".jpg", ".jpeg", ".webp", ".pdf"],
    allowedMimes: ["image/png", "image/jpeg", "image/webp", "application/pdf"],
  },
  print_doc: {
    maxBytes: 25 * 1024 * 1024,
    maxLabel: "25 MB",
    allowedExtensions: [
      ".pdf",
      ".doc",
      ".docx",
      ".ppt",
      ".pptx",
      ".xls",
      ".xlsx",
      ".png",
      ".jpg",
      ".jpeg",
      ".webp",
      ".txt",
    ],
    allowedMimes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "image/png",
      "image/jpeg",
      "image/webp",
      "text/plain",
    ],
  },
};

const DANGEROUS_EXTENSIONS = new Set([
  ".svg",
  ".svgz",
  ".html",
  ".htm",
  ".xhtml",
  ".xml",
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".jsx",
  ".php",
  ".phtml",
  ".jsp",
  ".asp",
  ".aspx",
  ".exe",
  ".dll",
  ".bat",
  ".cmd",
  ".ps1",
  ".sh",
  ".vbs",
  ".jar",
]);

export function sanitizeFileName(rawName: string): string {
  const base = path.basename(rawName || "upload")
    .replace(/[\x00-\x1F\x7F"'\\/<>:|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  const safe = base || "upload";
  return safe.length > 180 ? safe.slice(-180) : safe;
}

function sniffMagicBytes(buffer: Buffer, ext: string): string | null {
  if (buffer.length === 0) return null;

  // Reject disguised HTML/SVG/script payloads regardless of extension
  const headText = buffer.subarray(0, Math.min(buffer.length, 1024)).toString("utf8").trimStart().toLowerCase();
  if (
    headText.startsWith("<svg") ||
    headText.startsWith("<!doctype html") ||
    headText.startsWith("<html") ||
    headText.startsWith("<script") ||
    headText.startsWith("<?php") ||
    (headText.startsWith("<?xml") && headText.includes("<svg"))
  ) {
    return "DANGEROUS_MARKUP";
  }

  // PNG
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  // JPEG
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // GIF
  if (
    buffer.length >= 6 &&
    (buffer.subarray(0, 6).toString("ascii") === "GIF87a" ||
      buffer.subarray(0, 6).toString("ascii") === "GIF89a")
  ) {
    return "image/gif";
  }

  // WEBP
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  // HEIC / HEIF (ISO BMFF)
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buffer.subarray(8, 12).toString("ascii").toLowerCase();
    if (["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(brand)) {
      return "image/heic";
    }
  }

  // PDF
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }

  // OOXML (.docx, .pptx, .xlsx) are ZIP containers (PK\x03\x04)
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05) &&
    (buffer[3] === 0x04 || buffer[3] === 0x06)
  ) {
    if (ext === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (ext === ".pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    if (ext === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }

  // Legacy MS Office OLE2 compound binary (.doc, .ppt, .xls)
  if (
    buffer.length >= 8 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0 &&
    buffer[4] === 0xa1 &&
    buffer[5] === 0xb1 &&
    buffer[6] === 0x1a &&
    buffer[7] === 0xe1
  ) {
    if (ext === ".doc") return "application/msword";
    if (ext === ".ppt") return "application/vnd.ms-powerpoint";
    if (ext === ".xls") return "application/vnd.ms-excel";
  }

  // Plain text (.txt): verify no null bytes and no active HTML/script tags
  if (ext === ".txt") {
    const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
    if (sample.includes(0x00)) return null;
    const lowerSample = sample.toString("utf8").toLowerCase();
    if (/<script[\s>]|<iframe[\s>]|<svg[\s>]|javascript:/i.test(lowerSample)) {
      return "DANGEROUS_MARKUP";
    }
    return "text/plain";
  }

  return null;
}

export interface ValidatedUploadResult {
  ok: true;
  fileName: string;
  mimeType: string;
  extension: string;
  size: number;
}

export interface RejectedUploadResult {
  ok: false;
  error: string;
  reason: string;
}

export async function validateUploadedFile(
  file: File | null | undefined,
  category: UploadPolicyCategory
): Promise<ValidatedUploadResult | RejectedUploadResult> {
  if (!file || typeof file.arrayBuffer !== "function") {
    return { ok: false, error: "No file provided.", reason: "missing_file" };
  }

  const policy = UPLOAD_POLICIES[category];
  if (file.size <= 0) {
    return { ok: false, error: "Uploaded file is empty.", reason: "empty_file" };
  }
  if (file.size > policy.maxBytes) {
    return {
      ok: false,
      error: `File "${sanitizeFileName(file.name)}" exceeds the maximum allowed size of ${policy.maxLabel}.`,
      reason: "file_too_large",
    };
  }

  const safeName = sanitizeFileName(file.name);
  const ext = path.extname(safeName).toLowerCase();

  if (!ext || DANGEROUS_EXTENSIONS.has(ext) || !policy.allowedExtensions.includes(ext)) {
    return {
      ok: false,
      error: `Unsupported file type (${ext || "unknown"}). Allowed types: ${policy.allowedExtensions.join(", ")}.`,
      reason: "disallowed_extension",
    };
  }

  const providedMime = (file.type || "").split(";")[0].trim().toLowerCase();
  if (
    providedMime &&
    providedMime !== "application/octet-stream" &&
    !policy.allowedMimes.includes(providedMime)
  ) {
    return {
      ok: false,
      error: `Unsupported file MIME type (${providedMime}).`,
      reason: "disallowed_mime",
    };
  }

  const scanBuffer =
    ext === ".txt"
      ? Buffer.from(await file.arrayBuffer())
      : Buffer.from(await file.slice(0, 8192).arrayBuffer());
  const detectedMime =
    ext === ".txt"
      ? (() => {
          if (scanBuffer.includes(0x00)) return null;
          const fullText = scanBuffer.toString("utf8").toLowerCase();
          if (/<script[\s>]|<iframe[\s>]|<svg[\s>]|javascript:/i.test(fullText)) {
            return "DANGEROUS_MARKUP";
          }
          return "text/plain";
        })()
      : sniffMagicBytes(scanBuffer, ext);

  if (detectedMime === "DANGEROUS_MARKUP") {
    return {
      ok: false,
      error: "Active script or markup payloads are strictly prohibited in file uploads.",
      reason: "dangerous_markup_signature",
    };
  }

  if (!detectedMime || !policy.allowedMimes.includes(detectedMime)) {
    return {
      ok: false,
      error: `File content does not match an allowed ${ext} format.`,
      reason: "magic_byte_mismatch",
    };
  }

  return {
    ok: true,
    fileName: safeName,
    mimeType: detectedMime,
    extension: ext,
    size: file.size,
  };
}
