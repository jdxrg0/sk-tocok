/**
 * SK TOCOK TRANSPARENCY PROGRAM — GOOGLE APPS SCRIPT WEBHOOK
 *
 * Paste this into https://script.google.com (your existing Apps Script project),
 * then click: Deploy -> Manage deployments -> Edit (pencil) -> New version -> Deploy.
 *
 * - Automatically sorts every upload into subfolders inside `SK Tocok Student Prints`:
 *     Vouchers/  |  Deposits/  |  Officials/  |  Prints/
 * - Also includes `organizeExistingFiles()` — select it in the toolbar and click Run
 *   once to move all existing files in the root folder into their matching subfolders
 *   (file IDs and website links stay 100% intact!).
 * - Set Script Properties `APPS_SCRIPT_WEBHOOK_SECRET` and
 *   `GOOGLE_DRIVE_ROOT_FOLDER_ID` under Project Settings -> Script Properties.
 */

function getRootFolderId_() {
  const folderId = PropertiesService.getScriptProperties().getProperty("GOOGLE_DRIVE_ROOT_FOLDER_ID");
  if (!folderId) {
    throw new Error("Missing Script Property: GOOGLE_DRIVE_ROOT_FOLDER_ID");
  }
  return folderId.trim();
}

function getOrCreateSubfolder_(rootFolder, subfolderName) {
  const cleanName = String(subfolderName || "").trim();
  if (!cleanName) return rootFolder;

  const existing = rootFolder.getFoldersByName(cleanName);
  if (existing.hasNext()) {
    return existing.next();
  }
  return rootFolder.createFolder(cleanName);
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const expectedSecret = PropertiesService.getScriptProperties().getProperty("APPS_SCRIPT_WEBHOOK_SECRET");
    if (!expectedSecret || payload.webhookSecret !== expectedSecret) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: "Unauthorized webhook caller" })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    const fileName = payload.fileName || "upload_" + Date.now();
    const mimeType = payload.mimeType || "application/octet-stream";
    const base64 = payload.base64;

    if (!base64) {
      throw new Error("Missing base64 file content");
    }

    const rootFolder = DriveApp.getFolderById(getRootFolderId_());
    let targetFolder = rootFolder;

    // Priority 1: Use explicit subfolder name ("Vouchers", "Deposits", "Officials", "Prints")
    if (payload.folder) {
      targetFolder = getOrCreateSubfolder_(rootFolder, payload.folder);
    } else if (payload.folderId) {
      // Priority 2: Use explicit folderId if provided
      try {
        targetFolder = DriveApp.getFolderById(payload.folderId);
      } catch (_) {
        targetFolder = rootFolder;
      }
    }

    const bytes = Utilities.base64Decode(base64);
    const blob = Utilities.newBlob(bytes, mimeType, fileName);
    const file = targetFolder.createFile(blob);

    const isPrivate =
      payload.isPrivate !== false ||
      String(payload.folder || "").trim().toLowerCase() === "prints";

    // Keep Drive uploads restricted and stream via /api/drive/<fileId> unless explicitly public-legacy
    if (isPrivate) {
      try {
        file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
      } catch (_) {}
    } else {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }

    return ContentService.createTextOutput(
      JSON.stringify({
        success: true,
        fileId: file.getId(),
        url: file.getUrl(),
        folder: targetFolder.getName(),
      })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({
        success: false,
        error: String(err && err.message ? err.message : err),
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * One-time helper: run this once inside the Apps Script editor to sort all
 * existing files in `SK Tocok Student Prints` into Vouchers/, Deposits/,
 * Officials/, and Prints/ without changing any file IDs or breaking links.
 */
function organizeExistingFiles() {
  const rootFolder = DriveApp.getFolderById(getRootFolderId_());
  const folders = {
    Vouchers: getOrCreateSubfolder_(rootFolder, "Vouchers"),
    Deposits: getOrCreateSubfolder_(rootFolder, "Deposits"),
    Officials: getOrCreateSubfolder_(rootFolder, "Officials"),
    Prints: getOrCreateSubfolder_(rootFolder, "Prints"),
  };

  const files = rootFolder.getFiles();
  const moved = { Vouchers: 0, Deposits: 0, Officials: 0, Prints: 0, Skipped: 0 };

  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName();
    let dest = null;

    if (name.indexOf("[SK-Tocok Voucher]") === 0) {
      dest = "Vouchers";
    } else if (name.indexOf("[SK-Tocok Deposit]") === 0) {
      dest = "Deposits";
    } else if (name.indexOf("[SK-Tocok Official]") === 0) {
      dest = "Officials";
    } else if (name.indexOf("[SK-Tocok]") === 0) {
      dest = "Prints";
    }

    if (dest) {
      file.moveTo(folders[dest]);
      moved[dest]++;
    } else {
      moved.Skipped++;
    }
  }

  Logger.log("Finished organizing files: " + JSON.stringify(moved));
}
