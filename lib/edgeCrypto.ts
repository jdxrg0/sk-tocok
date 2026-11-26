const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padded = base64Url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (base64Url.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToUint8Array(hex: string): Uint8Array | null {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
    return null;
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function generateRandomHex(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return uint8ArrayToHex(bytes);
}

async function importHmacKey(secret: string, usage: ("sign" | "verify")[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    toArrayBuffer(encoder.encode(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usage
  );
}

export async function signHmacToken(value: string, secret: string): Promise<string> {
  const key = await importHmacKey(secret, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, toArrayBuffer(encoder.encode(value)));
  return `${value}.${uint8ArrayToHex(new Uint8Array(sig))}`;
}

export async function verifyHmacToken(signedToken: string, secret: string): Promise<string | null> {
  if (!signedToken || !secret) return null;
  const dotIdx = signedToken.lastIndexOf(".");
  if (dotIdx <= 0) return null;
  const value = signedToken.slice(0, dotIdx);
  const sigHex = signedToken.slice(dotIdx + 1);
  const sigBytes = hexToUint8Array(sigHex);
  if (!sigBytes) return null;

  const key = await importHmacKey(secret, ["verify"]);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    toArrayBuffer(sigBytes),
    toArrayBuffer(encoder.encode(value))
  );
  return valid ? value : null;
}

export interface EdgeJwtPayload {
  id?: number;
  name?: string;
  email?: string;
  role?: string;
  token_version?: number;
  exp?: number;
  nbf?: number;
  iss?: string;
  aud?: string;
  [key: string]: unknown;
}

/**
 * Edge-compatible HS256 JWT verifier using Web Crypto API.
 */
export async function verifyHs256JwtEdge(
  token: string,
  secret: string,
  options?: { issuer?: string; audience?: string }
): Promise<EdgeJwtPayload | null> {
  try {
    if (!token || !secret || secret.length < 32) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, sigB64] = parts;
    const headerJson = JSON.parse(decoder.decode(base64UrlToUint8Array(headerB64))) as {
      alg?: string;
      typ?: string;
    };
    if (headerJson.alg !== "HS256") return null;

    const key = await importHmacKey(secret, ["verify"]);
    const sigBytes = base64UrlToUint8Array(sigB64);
    const dataBytes = encoder.encode(`${headerB64}.${payloadB64}`);
    const valid = await crypto.subtle.verify("HMAC", key, toArrayBuffer(sigBytes), toArrayBuffer(dataBytes));
    if (!valid) return null;

    const payload = JSON.parse(decoder.decode(base64UrlToUint8Array(payloadB64))) as EdgeJwtPayload;
    const nowSec = Math.floor(Date.now() / 1000);

    if (typeof payload.exp !== "number" || payload.exp <= nowSec) return null;
    if (typeof payload.nbf === "number" && payload.nbf > nowSec) return null;
    if (options?.issuer && payload.iss !== options.issuer) return null;
    if (options?.audience && payload.aud !== options.audience) return null;

    return payload;
  } catch {
    return null;
  }
}
