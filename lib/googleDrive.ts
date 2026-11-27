import { google, type drive_v3 } from "googleapis";
import { Readable } from "stream";
import fs from "fs";
import path from "path";
import { saveUploadedFile, inferMimeType } from "./storage";
import { getAppsScriptWebhookSecret } from "./env";
import { sanitizeFileName } from "./fileValidation";

export type CloudUploadCategory = "prints" | "vouchers" | "deposits" | "officials" | "attendance";

export interface UploadResult {
  filePath: string;
  fileName: string;
  fileSize: number;
  isGoogleDrive?: boolean;
  googleDriveFileId?: string;
  webViewLink?: string;
}

export interface DriveFolderStat {
  key: CloudUploadCategory;
  name: string;
  label: string;
  folderId: string;
  files: number;
  totalBytes: number;
  webViewLink?: string;
}

export interface GoogleDriveStatusData {
  success: boolean;
  configured: boolean;
  status: "online" | "not_configured" | "offline";
  statusLevel: "healthy" | "warning" | "critical";
  latencyMs?: number;
  storage?: {
    usedBytes: number;
    limitBytes: number;
    remainingBytes: number;
    usagePercent: number;
  };
  totalFiles?: number;
  rootFolder?: {
    id?: string;
    name?: string;
    webViewLink?: string;
  };
  folders?: DriveFolderStat[];
  method?: string;
  serviceAccountEmail?: string;
  hasAppsScript?: boolean;
  plan?: {
    name: string;
    storageLimitLabel: string;
    description: string;
  };
  checkedAt?: string;
  error?: string;
}

export interface DriveClientResult {
  drive: drive_v3.Drive;
  folderId?: string;
  clientEmail?: string;
}

const FOLDER_MIME = "application/vnd.google-apps.folder";

const CATEGORY_CONFIG: Record<
  CloudUploadCategory,
  {
    prefix: string;
    driveFolderName: string;
    envFolderIdKey: string;
    defaultSubfolderId: string;
    blobFolder: string;
    dbFolder: "prints" | "receipts" | "officials" | "attendance";
    useInlineProxy: boolean;
  }
> = {
  prints: {
    prefix: "[SK-Tocok]",
    driveFolderName: "Prints",
    envFolderIdKey: "GOOGLE_DRIVE_PRINTS_FOLDER_ID",
    defaultSubfolderId: "1GSRv3exdbMpJv39o5NZAUkRCQ-5qUgPw",
    blobFolder: "prints",
    dbFolder: "prints",
    useInlineProxy: true, // Always served via authenticated /api/drive/<id> proxy
  },
  vouchers: {
    prefix: "[SK-Tocok Voucher]",
    driveFolderName: "Vouchers",
    envFolderIdKey: "GOOGLE_DRIVE_VOUCHERS_FOLDER_ID",
    defaultSubfolderId: "18AqjvmmTPUT8CPZNPzMWtlhnT4jlB8ta",
    blobFolder: "receipts",
    dbFolder: "receipts",
    useInlineProxy: true, // Served via /api/drive/<id> so <img> & PDF tabs work seamlessly
  },
  deposits: {
    prefix: "[SK-Tocok Deposit]",
    driveFolderName: "Deposits",
    envFolderIdKey: "GOOGLE_DRIVE_DEPOSITS_FOLDER_ID",
    defaultSubfolderId: "1xGURWqpsVz6cCQYa_Yi5mf9z6XTF556N",
    blobFolder: "receipts",
    dbFolder: "receipts",
    useInlineProxy: true,
  },
  officials: {
    prefix: "[SK-Tocok Official]",
    driveFolderName: "Officials",
    envFolderIdKey: "GOOGLE_DRIVE_OFFICIALS_FOLDER_ID",
    defaultSubfolderId: "16W6W6wLGzYKByKqUwsZecUBrPHe4Thz5",
    blobFolder: "officials",
    dbFolder: "officials",
    useInlineProxy: true,
  },
  attendance: {
    prefix: "[SK-Tocok Attendance]",
    driveFolderName: "Attendance",
    envFolderIdKey: "GOOGLE_DRIVE_ATTENDANCE_FOLDER_ID",
    defaultSubfolderId: "",
    blobFolder: "attendance",
    dbFolder: "attendance",
    useInlineProxy: true,
  },
};

const subfolderIdCache = new Map<string, string>();

function extractDriveFileId(rawId?: string | null, rawUrl?: string | null): string | undefined {
  if (rawId && /^[a-zA-Z0-9_-]{10,}$/.test(rawId.trim())) {
    return rawId.trim();
  }
  if (rawUrl) {
    const m1 = rawUrl.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
    if (m1) return m1[1];
    const m2 = rawUrl.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
    if (m2) return m2[1];
  }
  return undefined;
}

let cachedDriveClient: DriveClientResult | null = null;

/**
 * Returns an authenticated Google Drive client if credentials exist in .env.local or a JSON key file.
 * The client instance is cached in memory across requests to preserve OAuth2 access tokens.
 */
export function getDriveClient(): DriveClientResult | null {
  if (cachedDriveClient) {
    return cachedDriveClient;
  }

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  // 1. Try environment variables
  if (clientEmail && privateKey) {
    privateKey = privateKey.replace(/\\n/g, "\n");
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });
    cachedDriveClient = { drive: google.drive({ version: "v3", auth }), folderId, clientEmail };
    return cachedDriveClient;
  }

  // 2. Try service account JSON file in root or specified path
  const jsonKeyPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.join(process.cwd(), "google-service-account.json");
  if (fs.existsSync(jsonKeyPath)) {
    try {
      const creds = JSON.parse(fs.readFileSync(jsonKeyPath, "utf8")) as {
        client_email?: string;
        private_key?: string;
      };
      if (creds.client_email && creds.private_key) {
        const auth = new google.auth.JWT({
          email: creds.client_email,
          key: creds.private_key,
          scopes: ["https://www.googleapis.com/auth/drive"],
        });
        cachedDriveClient = { drive: google.drive({ version: "v3", auth }), folderId, clientEmail: creds.client_email };
        return cachedDriveClient;
      }
    } catch (e) {
      console.warn("Failed to initialize Google Drive auth from key file:", e);
    }
  }

  return null;
}

/**
 * Finds or creates a named subfolder (`Vouchers`, `Deposits`, `Officials`, `Prints`)
 * inside the root Google Drive folder, caching its ID in memory.
 */
async function resolveSubfolderId(
  category: CloudUploadCategory,
  driveInfo: { drive: drive_v3.Drive; folderId?: string } | null
): Promise<string | undefined> {
  const cfg = CATEGORY_CONFIG[category];

  // 1. Explicit env override takes precedence
  const envSpecific = process.env[cfg.envFolderIdKey];
  if (envSpecific && envSpecific.trim()) {
    return envSpecific.trim();
  }

  const rootFolderId = driveInfo?.folderId || process.env.GOOGLE_DRIVE_FOLDER_ID;
  const cacheKey = `${rootFolderId || "default"}:${cfg.driveFolderName}`;
  const cached = subfolderIdCache.get(cacheKey);
  if (cached) return cached;

  // 2. Dynamically look up or create the subfolder if Drive API client is available
  if (driveInfo && rootFolderId) {
    try {
      const safeName = cfg.driveFolderName.replace(/'/g, "\\'");
      const existing = await driveInfo.drive.files.list({
        q: `'${rootFolderId}' in parents and name = '${safeName}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
        fields: "files(id)",
        pageSize: 1,
      });

      const foundId = existing.data.files?.[0]?.id;
      if (foundId) {
        subfolderIdCache.set(cacheKey, foundId);
        return foundId;
      }

      const created = await driveInfo.drive.files.create({
        requestBody: {
          name: cfg.driveFolderName,
          mimeType: FOLDER_MIME,
          parents: [rootFolderId],
        },
        fields: "id",
      });

      if (created.data.id) {
        subfolderIdCache.set(cacheKey, created.data.id);
        return created.data.id;
      }
    } catch (err) {
      console.warn(`Subfolder lookup failed for ${cfg.driveFolderName}, using default ID:`, err);
    }
  }

  // 3. Fall back to the pre-created subfolder ID inside `SK Tocok Student Prints`
  return cfg.defaultSubfolderId || rootFolderId;
}

/**
 * Helper to execute a fetch with automatic retries and exponential backoff
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        signal: options.signal || AbortSignal.timeout(8000),
      });
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        return res;
      }
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, attempt * 1000));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, attempt * 1000));
      }
    }
  }
  throw lastError || new Error(`Failed to reach ${url} after ${maxRetries} attempts`);
}

/**
 * Uploads any file (voucher, deposit slip, official avatar, or student print document) to cloud storage:
 * - 1st priority: Google Drive via Google Apps Script Webhook (sorted into Vouchers / Deposits / Officials / Prints).
 * - 2nd priority: Direct Google Drive API (Service Account / Workspace Shared Drive).
 * - 3rd priority: Vercel Blob (automated cloud failover when BLOB_READ_WRITE_TOKEN is set).
 * - 4th priority: Neon Postgres Cloud Database (`stored_files`, <= 10 MB emergency failover — zero local disk).
 */
export async function uploadToCloudStorage(
  file: File,
  category: CloudUploadCategory
): Promise<UploadResult> {
  const cfg = CATEGORY_CONFIG[category];
  const originalName = sanitizeFileName(file.name || "document.pdf");
  const mimeType = inferMimeType(originalName, file.type);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const driveFileName = `${cfg.prefix} ${timestamp} - ${originalName}`;

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const driveInfo = getDriveClient();
  const targetFolderId = await resolveSubfolderId(category, driveInfo);

  // 1. First priority: Google Apps Script Webhook (Personal Google Drive — 15 GB free)
  const appsScriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
  const webhookSecret = getAppsScriptWebhookSecret();
  if (appsScriptUrl) {
    try {
      const base64 = buffer.toString("base64");

      const res = await fetchWithRetry(
        appsScriptUrl,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(webhookSecret ? { webhookSecret } : {}),
            fileName: driveFileName,
            mimeType,
            base64,
            folder: cfg.driveFolderName,
            folderId: targetFolderId,
            isPrivate: category === "prints",
          }),
          redirect: "follow",
        },
        3
      );

      if (res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          if (data && data.success && (data.url || data.fileId)) {
            const fileId = extractDriveFileId(data.fileId, data.url);
            const webViewLink =
              data.url || (fileId ? `https://drive.google.com/file/d/${fileId}/view` : "");
            const filePath =
              cfg.useInlineProxy && fileId ? `/api/drive/${fileId}` : webViewLink;

            return {
              filePath,
              fileName: originalName,
              fileSize: buffer.length,
              isGoogleDrive: true,
              googleDriveFileId: fileId,
              webViewLink,
            };
          } else {
            console.warn(
              "Google Apps Script returned unsuccessful status:",
              data?.error || text
            );
          }
        } catch {
          console.warn("Failed to parse Google Apps Script JSON response:", text);
        }
      } else {
        console.warn("Google Apps Script HTTP error:", res.status, res.statusText);
      }
    } catch (scriptErr) {
      console.error(
        "Google Apps Script upload error after retries, failing over to secondary cloud storage:",
        scriptErr
      );
    }
  }

  // 2. Second priority: Direct Google Drive API (Service Account / Workspace Shared Drive)
  if (driveInfo) {
    try {
      const { drive } = driveInfo;
      const stream = Readable.from(buffer);

      const requestBody: { name: string; parents?: string[] } = {
        name: driveFileName,
      };
      if (targetFolderId) {
        requestBody.parents = [targetFolderId];
      }

      const uploadResponse = await drive.files.create({
        requestBody,
        media: {
          mimeType,
          body: stream,
        },
        fields: "id, name, webViewLink, webContentLink, size",
      });

      const fileId = uploadResponse.data.id;
      if (fileId) {
        if (category !== "prints") {
          try {
            await drive.permissions.create({
              fileId,
              requestBody: {
                role: "reader",
                type: "anyone",
              },
            });
          } catch {
            // Ignore permission errors if folder already grants public read
          }
        }

        const webViewLink =
          uploadResponse.data.webViewLink ||
          uploadResponse.data.webContentLink ||
          `https://drive.google.com/file/d/${fileId}/view`;
        const filePath = cfg.useInlineProxy ? `/api/drive/${fileId}` : webViewLink;

        return {
          filePath,
          fileName: originalName,
          fileSize: buffer.length,
          isGoogleDrive: true,
          googleDriveFileId: fileId,
          webViewLink,
        };
      }
    } catch (driveErr) {
      console.error("Google Drive API upload error, checking secondary cloud storage:", driveErr);
    }
  }

  // 3. Third priority: Vercel Blob (Automated Cloud Failover for public-safe assets only)
  // Private student print files bypass public Vercel Blob and use authenticated Neon DB storage below.
  if (process.env.BLOB_READ_WRITE_TOKEN && category !== "prints") {
    try {
      const { put } = await import("@vercel/blob");
      const blob = await put(`${cfg.blobFolder}/${driveFileName}`, buffer, {
        access: "public",
        contentType: mimeType,
        addRandomSuffix: true,
      });

      if (blob && blob.url) {
        return {
          filePath: blob.url,
          fileName: originalName,
          fileSize: buffer.length,
          isGoogleDrive: false,
          webViewLink: blob.url,
        };
      }
    } catch (blobErr) {
      console.error("Vercel Blob failover error:", blobErr);
    }
  }

  // 4. Fourth priority: Neon Postgres Cloud Database (`stored_files` — emergency failover <= 10 MB, zero local disk)
  const MAX_DB_FALLBACK_BYTES = 10 * 1024 * 1024;
  if (buffer.length <= MAX_DB_FALLBACK_BYTES) {
    return await saveUploadedFile(file, cfg.dbFolder);
  }

  throw new Error(
    "Google Drive and backup cloud storage are temporarily unreachable. Please try again in a moment."
  );
}

/**
 * Convenience helper for student print uploads.
 */
export async function savePrintDocument(file: File): Promise<UploadResult> {
  return uploadToCloudStorage(file, "prints");
}

const CATEGORY_LABELS: Record<CloudUploadCategory, string> = {
  prints: "Student Prints",
  vouchers: "Disbursement Vouchers",
  deposits: "Bank Deposits",
  officials: "Official Avatars",
  attendance: "Attendance & Session Photo Proof",
};

const DEFAULT_DRIVE_LIMIT_TB = 5; // Default 5 TB Google Drive plan

/**
 * Checks Google Drive status, latency, folders, and storage metrics across the 4 primary categories.
 */
export async function getGoogleDriveStatus(): Promise<GoogleDriveStatusData> {
  const startTime = Date.now();
  const driveInfo = getDriveClient();
  const appsScriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
  const rootFolderId = driveInfo?.folderId || process.env.GOOGLE_DRIVE_FOLDER_ID;

  const limitTbEnv = Number(process.env.GOOGLE_DRIVE_LIMIT_TB);
  const limitGbEnv = Number(process.env.GOOGLE_DRIVE_LIMIT_GB);

  let limitBytes: number;
  let storageLimitLabel: string;
  let planName: string;

  if (Number.isFinite(limitTbEnv) && limitTbEnv > 0) {
    limitBytes = limitTbEnv * 1024 * 1024 * 1024 * 1024;
    storageLimitLabel = `${limitTbEnv} TB`;
    planName = `Google Drive (${limitTbEnv} TB Plan)`;
  } else if (Number.isFinite(limitGbEnv) && limitGbEnv > 0) {
    limitBytes = limitGbEnv * 1024 * 1024 * 1024;
    if (limitGbEnv >= 1024 && limitGbEnv % 1024 === 0) {
      const tb = limitGbEnv / 1024;
      storageLimitLabel = `${tb} TB`;
      planName = `Google Drive (${tb} TB Plan)`;
    } else {
      storageLimitLabel = `${limitGbEnv} GB`;
      planName = `Google Drive (${limitGbEnv} GB Plan)`;
    }
  } else {
    limitBytes = DEFAULT_DRIVE_LIMIT_TB * 1024 * 1024 * 1024 * 1024;
    storageLimitLabel = `${DEFAULT_DRIVE_LIMIT_TB} TB`;
    planName = `Google Drive (${DEFAULT_DRIVE_LIMIT_TB} TB Plan)`;
  }

  const plan = {
    name: planName,
    storageLimitLabel,
    description: "Primary cloud storage for student print files, vouchers, deposits & official photos.",
  };

  if (!driveInfo && !appsScriptUrl && !rootFolderId) {
    return {
      success: true,
      configured: false,
      status: "not_configured",
      statusLevel: "healthy",
      storage: {
        usedBytes: 0,
        limitBytes,
        remainingBytes: limitBytes,
        usagePercent: 0,
      },
      totalFiles: 0,
      folders: [],
      plan,
      checkedAt: new Date().toISOString(),
    };
  }

  if (driveInfo) {
    try {
      const { drive, clientEmail } = driveInfo;

      let pingLatency: number | undefined;
      const pingStart = Date.now();
      const rootFolderPromise = rootFolderId
        ? drive.files
            .get({
              fileId: rootFolderId,
              fields: "id, name, webViewLink",
            })
            .then((r) => {
              pingLatency = Math.max(1, Date.now() - pingStart);
              return {
                id: r.data.id || rootFolderId,
                name: r.data.name || "SK Tocok Student Prints",
                webViewLink:
                  r.data.webViewLink ||
                  `https://drive.google.com/drive/folders/${rootFolderId}`,
              };
            })
            .catch(() => {
              pingLatency = Math.max(1, Date.now() - pingStart);
              return {
                id: rootFolderId,
                name: "SK Tocok Student Prints",
                webViewLink: `https://drive.google.com/drive/folders/${rootFolderId}`,
              };
            })
        : Promise.resolve(undefined);

      const categories: CloudUploadCategory[] = [
        "prints",
        "vouchers",
        "deposits",
        "officials",
        "attendance",
      ];
      const folderPromises = categories.map(async (cat) => {
        const cfg = CATEGORY_CONFIG[cat];
        const folderId = await resolveSubfolderId(cat, driveInfo);

        if (!folderId) {
          return {
            key: cat,
            name: cfg.driveFolderName,
            label: CATEGORY_LABELS[cat],
            folderId: "",
            files: 0,
            totalBytes: 0,
          };
        }

        try {
          const listRes = await drive.files.list({
            q: `'${folderId}' in parents and trashed = false and mimeType != '${FOLDER_MIME}'`,
            fields: "files(id, name, size, mimeType, createdTime)",
            pageSize: 1000,
          });

          const files = listRes.data.files || [];
          const totalBytes = files.reduce((acc, f) => acc + Number(f.size || 0), 0);

          return {
            key: cat,
            name: cfg.driveFolderName,
            label: CATEGORY_LABELS[cat],
            folderId,
            files: files.length,
            totalBytes,
            webViewLink: `https://drive.google.com/drive/folders/${folderId}`,
          };
        } catch (subErr) {
          console.warn(`Drive folder stat error for ${cat}:`, subErr);
          return {
            key: cat,
            name: cfg.driveFolderName,
            label: CATEGORY_LABELS[cat],
            folderId,
            files: 0,
            totalBytes: 0,
            webViewLink: `https://drive.google.com/drive/folders/${folderId}`,
          };
        }
      });

      const [rootFolder, ...folderStats] = await Promise.all([rootFolderPromise, ...folderPromises]);

      const latencyMs = pingLatency || Math.max(1, Date.now() - startTime);
      const totalFiles = folderStats.reduce((acc, f) => acc + f.files, 0);
      const usedBytes = folderStats.reduce((acc, f) => acc + f.totalBytes, 0);
      const remainingBytes = Math.max(0, limitBytes - usedBytes);
      const usagePercent = Math.min(100, Number(((usedBytes / limitBytes) * 100).toFixed(2)));

      let statusLevel: "healthy" | "warning" | "critical" = "healthy";
      if (usagePercent >= 90) {
        statusLevel = "critical";
      } else if (usagePercent >= 70) {
        statusLevel = "warning";
      }

      const method = appsScriptUrl
        ? "Hybrid (Service Account API + Apps Script Webhook)"
        : "Google Service Account API";

      return {
        success: true,
        configured: true,
        status: "online",
        statusLevel,
        latencyMs,
        storage: {
          usedBytes,
          limitBytes,
          remainingBytes,
          usagePercent,
        },
        totalFiles,
        rootFolder,
        folders: folderStats,
        method,
        serviceAccountEmail: clientEmail,
        hasAppsScript: Boolean(appsScriptUrl),
        plan,
        checkedAt: new Date().toISOString(),
      };
    } catch (err: unknown) {
      console.error("Google Drive status check error:", err);
      const latencyMs = Math.max(1, Date.now() - startTime);
      return {
        success: false,
        configured: true,
        status: "offline",
        statusLevel: "critical",
        latencyMs,
        error: "Unable to reach Google Drive storage right now.",
        checkedAt: new Date().toISOString(),
      };
    }
  }

  // Fallback: only Apps Script URL or Folder ID configured
  const latencyMs = Math.max(1, Date.now() - startTime);
  return {
    success: true,
    configured: true,
    status: "online",
    statusLevel: "healthy",
    latencyMs,
    storage: {
      usedBytes: 0,
      limitBytes,
      remainingBytes: limitBytes,
      usagePercent: 0,
    },
    totalFiles: 0,
    rootFolder: rootFolderId
      ? {
          id: rootFolderId,
          name: "SK Tocok Student Prints",
          webViewLink: `https://drive.google.com/drive/folders/${rootFolderId}`,
        }
      : undefined,
    folders: [],
    method: "Google Apps Script Webhook",
    hasAppsScript: true,
    plan,
    checkedAt: new Date().toISOString(),
  };
}
