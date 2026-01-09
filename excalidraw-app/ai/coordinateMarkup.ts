/**
 * Coordinate Markup Utilities
 *
 * Pre-processes markdown HTML to wrap coordinates and regions in interactive spans.
 * Supports multiple coordinate formats commonly found in AI output.
 *
 * Supported formats:
 * - Point coordinates: (123, 456) or (123,456)
 * - Region "from/to": Region from (x1, y1) to (x2, y2)
 * - Bracket regions: [x1, y1, x2, y2]
 * - Bounding box format: bbox: [x1, y1, x2, y2]
 */

/**
 * Wrap coordinates and regions in HTML with data attributes for hover interactions.
 * This enables the AI log panel to highlight coordinates on the canvas when hovered.
 */
export const wrapCoordinatesInHtml = (html: string): string => {
  // First, wrap region patterns: "Region from (x1, y1) to (x2, y2)"
  // Use HTML entities for parentheses in the display text to prevent the coordinate
  // regex from matching them again
  let processed = html.replace(
    /Region from \((\d{1,5}(?:\.\d+)?),\s*(\d{1,5}(?:\.\d+)?)\) to \((\d{1,5}(?:\.\d+)?),\s*(\d{1,5}(?:\.\d+)?)\)/gi,
    (match, x1, y1, x2, y2) => {
      // Replace parentheses with HTML entities in the visible text to prevent double-wrapping
      const displayText = `Region from &#40;${x1}, ${y1}&#41; to &#40;${x2}, ${y2}&#41;`;
      return `<span class="region-highlight" data-x1="${x1}" data-y1="${y1}" data-x2="${x2}" data-y2="${y2}">${displayText}</span>`;
    },
  );

  // Wrap "bounding box" or "bbox" patterns: bbox: [x1, y1, x2, y2]
  processed = processed.replace(
    /(?:bounding\s*box|bbox):\s*\[(\d{1,5}(?:\.\d+)?),\s*(\d{1,5}(?:\.\d+)?),\s*(\d{1,5}(?:\.\d+)?),\s*(\d{1,5}(?:\.\d+)?)\]/gi,
    (match, x1, y1, x2, y2) => {
      return `<span class="region-highlight" data-x1="${x1}" data-y1="${y1}" data-x2="${x2}" data-y2="${y2}">${match}</span>`;
    },
  );

  // Wrap bracket region patterns: [x1, y1, x2, y2] (4 numbers)
  // Negative lookbehind/lookahead to avoid matching base64 or other encoded data
  processed = processed.replace(
    /(?<![A-Za-z0-9+/="])\[(\d{1,5}(?:\.\d+)?),\s*(\d{1,5}(?:\.\d+)?),\s*(\d{1,5}(?:\.\d+)?),\s*(\d{1,5}(?:\.\d+)?)\](?![A-Za-z0-9+/=])/g,
    (match, x1, y1, x2, y2) => {
      return `<span class="region-highlight" data-x1="${x1}" data-y1="${y1}" data-x2="${x2}" data-y2="${y2}">${match}</span>`;
    },
  );

  // Wrap "at (x, y)" or "point (x, y)" patterns
  processed = processed.replace(
    /(?:at|point|location|position)\s+\((\d{1,5}(?:\.\d+)?),\s*(\d{1,5}(?:\.\d+)?)\)/gi,
    (match, x, y) => {
      return `<span class="coord-highlight" data-x="${x}" data-y="${y}">${match}</span>`;
    },
  );

  // Wrap remaining standalone coordinates: (123, 456) or (123,456)
  // but NOT inside base64 data, URLs, or already wrapped spans
  processed = processed.replace(
    /(?<![A-Za-z0-9+/="-])(\((\d{1,5}(?:\.\d+)?),\s*(\d{1,5}(?:\.\d+)?)\))(?![A-Za-z0-9+/=])/g,
    (match, full, x, y) => {
      return `<span class="coord-highlight" data-x="${x}" data-y="${y}">${full}</span>`;
    },
  );

  return processed;
};

/**
 * Highlighted point coordinate
 */
export interface HighlightedPoint {
  type: "point";
  x: number;
  y: number;
}

/**
 * Highlighted region (bounding box)
 */
export interface HighlightedRegion {
  type: "region";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Union type for highlighted coordinates
 */
export type HighlightedCoordinate = HighlightedPoint | HighlightedRegion;

/**
 * Parse coordinate data from a DOM element's data attributes
 */
export const parseCoordinateFromElement = (
  element: HTMLElement,
): HighlightedCoordinate | null => {
  if (element.classList.contains("region-highlight")) {
    const x1 = parseFloat(element.dataset.x1 || "0");
    const y1 = parseFloat(element.dataset.y1 || "0");
    const x2 = parseFloat(element.dataset.x2 || "0");
    const y2 = parseFloat(element.dataset.y2 || "0");
    return { type: "region", x1, y1, x2, y2 };
  }

  if (element.classList.contains("coord-highlight")) {
    const x = parseFloat(element.dataset.x || "0");
    const y = parseFloat(element.dataset.y || "0");
    return { type: "point", x, y };
  }

  return null;
};
