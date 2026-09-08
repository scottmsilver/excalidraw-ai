import { heicTo, isHeic } from "heic-to";

/**
 * HEIC to JPEG Converter
 *
 * Converts HEIC/HEIF images (common on iOS devices) to JPEG format
 * for browser compatibility. Uses heic-to library with libheif.
 */

/**
 * Generate a loading placeholder SVG as a data URL.
 * Shows a spinner animation with "Converting..." text.
 * Uses SMIL animation which works in img tags (CSS animations don't).
 */
export const createLoadingPlaceholderDataURL = (
  width: number = 200,
  height: number = 200,
  isDark: boolean = false,
): string => {
  const bgColor = isDark ? "#1e1e1e" : "#f5f5f5";
  const textColor = isDark ? "#aaa" : "#666";
  const spinnerColor = isDark ? "#6965db" : "#4a47a3";
  const cx = width / 2;
  const cy = height / 2 - 15;

  // Using SMIL animateTransform for rotation - works in img tags
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="${bgColor}" rx="8"/>
  <g>
    <circle cx="${cx}" cy="${cy}" r="20" fill="none" stroke="${spinnerColor}" stroke-width="3" stroke-dasharray="80 40" stroke-linecap="round">
      <animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="1s" repeatCount="indefinite"/>
    </circle>
  </g>
  <text x="${cx}" y="${height / 2 + 30}" text-anchor="middle" fill="${textColor}" font-family="system-ui, sans-serif" font-size="14">Converting...</text>
</svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

/**
 * Create a File object from a loading placeholder.
 */
export const createLoadingPlaceholderFile = (
  originalFileName: string,
  isDark: boolean = false,
): File => {
  const svg = createLoadingPlaceholderDataURL(200, 200, isDark);
  const base64Data = svg.split(",")[1];
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: "image/svg+xml" });

  return new File([blob], `loading-${originalFileName}.svg`, {
    type: "image/svg+xml",
    lastModified: Date.now(),
  });
};

/**
 * Check if a file is HEIC/HEIF format based on extension or MIME type.
 * Fast synchronous check that doesn't read file contents.
 */
export const isHeicFile = (file: File): boolean => {
  // Check file extension (fast path for obvious cases)
  const fileName = file.name.toLowerCase();
  if (fileName.endsWith(".heic") || fileName.endsWith(".heif")) {
    return true;
  }

  // Check MIME type
  const heicMimeTypes = ["image/heic", "image/heif"];
  if (heicMimeTypes.includes(file.type.toLowerCase())) {
    return true;
  }

  return false;
};

/**
 * Check if a file is HEIC/HEIF by reading its headers (async, more accurate).
 * Uses heic-to's built-in isHeic which reads actual file bytes.
 */
export const isHeicFileAsync = async (file: File): Promise<boolean> => {
  try {
    return await isHeic(file);
  } catch {
    // Fall back to extension/mime check if header reading fails
    return isHeicFile(file);
  }
};

/**
 * Convert HEIC/HEIF file to JPEG format.
 *
 * @param file - HEIC/HEIF file to convert
 * @returns Promise that resolves to JPEG File object
 * @throws Error if conversion fails
 */
export const convertHeicToJpeg = async (file: File): Promise<File> => {
  try {
    // Convert HEIC to JPEG blob using heic-to
    const jpegBlob = await heicTo({
      blob: file,
      type: "image/jpeg",
      quality: 0.92,
    });

    // Create a new File object with .jpg extension
    const fileName = file.name.replace(/\.(heic|heif)$/i, ".jpg");

    return new File([jpegBlob], fileName, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    throw new Error(
      `Failed to convert HEIC image: ${errorMessage}. Please try a different image format.`,
    );
  }
};
