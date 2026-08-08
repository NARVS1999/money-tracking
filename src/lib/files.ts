// files.ts — platform-aware file save utility.
// Android: SAF (StorageAccessFramework) from expo-file-system/legacy → Downloads.
// iOS: expo-sharing → share sheet.
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

export function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    pdf: "application/pdf",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    csv: "text/csv",
  };
  return map[ext] || "application/octet-stream";
}

/**
 * Save content to a file. On Android, uses SAF to write to the user-chosen
 * directory (typically Downloads). On iOS, opens the share sheet.
 *
 * @param content - file content (UTF-8 string or base64 string)
 * @param filename - e.g. "money-tracking-2026-08-01-to-2026-08-31.pdf"
 * @param encoding - 'utf8' for text files, 'base64' for binary (PDF, Excel)
 */
export async function saveToFile(
  content: string,
  filename: string,
  encoding: "base64" | "utf8" = "utf8",
): Promise<void> {
  if (!FileSystem.cacheDirectory) {
    throw new Error("Cache directory unavailable");
  }
  const cachePath = `${FileSystem.cacheDirectory}${filename}`;
  const encType =
    encoding === "base64"
      ? FileSystem.EncodingType.Base64
      : FileSystem.EncodingType.UTF8;

  // Write to cache first
  await FileSystem.writeAsStringAsync(cachePath, content, { encoding: encType });

  try {
    if (Platform.OS === "android") {
      // SAF: request directory permission, create file, write content
      const dirUri =
        await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!dirUri.granted) {
        throw new Error("Storage permission denied");
      }
      const ext = filename.split(".").pop() || "";
      const fileUri =
        await FileSystem.StorageAccessFramework.createFileAsync(
          dirUri.directoryUri,
          filename,
          getMimeType(ext),
        );
      // Read from cache and write to SAF file
      const fileContent = await FileSystem.readAsStringAsync(cachePath, {
        encoding: encType,
      });
      await FileSystem.writeAsStringAsync(fileUri, fileContent, {
        encoding: encType,
      });
    } else {
      // iOS: use share sheet
      await Sharing.shareAsync(cachePath, {
        mimeType: getMimeType(filename.split(".").pop() || ""),
        dialogTitle: "Save export",
      });
    }
  } finally {
    // Clean up cache file
    try {
      await FileSystem.deleteAsync(cachePath, { idempotent: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}
