import dns from "dns/promises";
import net from "net";

/**
 * Sanitizes a URL before rendering it in <a href> or storing in DB.
 * Blocks javascript:, data:, vbscript:, file:, protocol-relative //, and control characters.
 */
export function sanitizeSafeUrl(
  rawUrl: string | null | undefined,
  options?: { allowRelative?: boolean; allowHttp?: boolean }
): string | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || /[\x00-\x1F\x7F]/.test(trimmed)) return null;

  const allowRelative = options?.allowRelative !== false;
  const allowHttp = options?.allowHttp === true;

  if (allowRelative && trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.startsWith("/\\")) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:") return parsed.toString();
    if (allowHttp && parsed.protocol === "http:") return parsed.toString();
    return null;
  } catch {
    return null;
  }
}

function isPrivateIpv4Int(ip: string): boolean {
  const parts = ip.split(".").map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // Link-local / cloud metadata 169.254.0.0/16
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 0 && parts[2] === 0) return true; // 192.0.0.0/24
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return true; // Benchmarking 198.18.0.0/15
  if (a >= 224) return true; // Multicast & reserved
  return false;
}

export function isPrivateOrReservedIp(ip: string): boolean {
  const cleaned = ip.trim().toLowerCase().replace(/^\[|\]$/g, "");
  const zoneIdx = cleaned.indexOf("%");
  const addr = zoneIdx !== -1 ? cleaned.slice(0, zoneIdx) : cleaned;

  const ipVersion = net.isIP(addr);
  if (ipVersion === 4) {
    return isPrivateIpv4Int(addr);
  }
  if (ipVersion === 6) {
    if (addr === "::" || addr === "::1") return true;
    if (addr.startsWith("::ffff:")) {
      const mappedV4 = addr.slice(7);
      if (net.isIP(mappedV4) === 4) return isPrivateIpv4Int(mappedV4);
      // Handle hex-encoded ::ffff:7f00:1
      return true;
    }
    if (addr.startsWith("fc") || addr.startsWith("fd")) return true; // ULA fc00::/7
    if (/^fe[89ab]/.test(addr)) return true; // Link-local fe80::/10
    if (addr.startsWith("ff")) return true; // Multicast ff00::/8
    return false;
  }
  return true;
}

/**
 * Validates that an external URL targets HTTPS/HTTP and resolves only to public IPs.
 * Protects against DNS rebinding, IP obfuscation, and internal metadata SSRF.
 */
export async function validatePublicExternalUrl(
  rawUrl: string,
  options?: { allowedHosts?: readonly string[]; requireHttps?: boolean }
): Promise<URL> {
  const parsed = new URL(rawUrl);

  if (options?.requireHttps) {
    if (parsed.protocol !== "https:") {
      throw new Error("Only HTTPS URLs are allowed");
    }
  } else if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Only HTTP/HTTPS URLs are allowed");
  }

  if (parsed.username || parsed.password) {
    throw new Error("URLs containing credentials are forbidden");
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".arpa")
  ) {
    throw new Error("Forbidden internal host");
  }

  if (options?.allowedHosts && options.allowedHosts.length > 0) {
    const matched = options.allowedHosts.some(
      (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`)
    );
    if (!matched) {
      throw new Error("Host is not in the trusted allowlist");
    }
  }

  if (net.isIP(hostname) !== 0) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new Error("Forbidden private or reserved IP address");
    }
    return parsed;
  }

  const records = await dns.lookup(hostname, { all: true });
  if (!records || records.length === 0) {
    throw new Error("Target host could not be resolved");
  }
  for (const rec of records) {
    if (isPrivateOrReservedIp(rec.address)) {
      throw new Error("Target host resolves to a private or reserved IP address");
    }
  }

  return parsed;
}
