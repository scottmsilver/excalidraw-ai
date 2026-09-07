import { MARKER_COLORS } from "../components/ReferencePoints/markerColors";

import type { ReferencePoint } from "../components/ReferencePoints/types";

/** Composite DOM-only reference markers at their exported image coordinates. */
export async function addReferenceMarkers(
  image: Blob,
  points: Pick<ReferencePoint, "x" | "y" | "label" | "index">[],
): Promise<Blob> {
  if (points.length === 0) {
    return image;
  }

  const bitmap = await createImageBitmap(image);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to draw reference markers");
    }
    context.drawImage(bitmap, 0, 0);

    for (const point of points) {
      const colors = MARKER_COLORS[point.index % MARKER_COLORS.length];
      context.beginPath();
      context.arc(point.x, point.y, 14, 0, Math.PI * 2);
      context.fillStyle = colors.bg;
      context.fill();
      context.strokeStyle = colors.border;
      context.lineWidth = 2;
      context.stroke();
      context.fillStyle = colors.text;
      context.font = "700 14px system-ui, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(point.label, point.x, point.y, 24);
    }

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Unable to export reference markers"));
        }
      }, "image/png");
    });
  } finally {
    bitmap.close();
  }
}
