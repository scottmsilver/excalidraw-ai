import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";

import "./ThinkingOverlay.scss";

export type ThinkingStatus =
  | "idle"
  | "thinking"
  | "reviewing"
  | "accepted"
  | "rejected";

/**
 * Track newly arrived images for drop-in animation
 */
interface NewImageState {
  index: number;
  timestamp: number;
}

/**
 * Canvas bounds for coordinate transformation.
 * These match the bounds used when exporting the canvas to an image.
 */
interface CanvasBounds {
  /** Left edge of the content bounding box (canvas coordinates) */
  minX: number;
  /** Top edge of the content bounding box (canvas coordinates) */
  minY: number;
  /** Padding added during export */
  exportPadding: number;
  /** Width of the exported image in pixels */
  imageWidth?: number;
  /** Height of the exported image in pixels */
  imageHeight?: number;
}

/**
 * Viewport state for canvas-to-screen transformation.
 */
interface ViewportState {
  /** Horizontal scroll offset */
  scrollX: number;
  /** Vertical scroll offset */
  scrollY: number;
  /** Current zoom level */
  zoom: number;
}

interface ThinkingOverlayProps {
  /** Current status of the thinking process */
  status: ThinkingStatus;
  /** Whether to show the rainbow border animation */
  showBorder?: boolean;
  /** Semi-transparent interim proposal image (base64 data URL) - shown during thinking */
  image?: string | null;
  /** All iteration images for review (shown in reviewing state) */
  iterationImages?: string[];
  /** Original marked-up canvas image for comparison during review */
  originalImage?: string | null;
  /** Width of the exported image in pixels */
  imageWidth?: number;
  /** Height of the exported image in pixels */
  imageHeight?: number;
  /** Canvas bounds from export (for positioning) */
  canvasBounds?: CanvasBounds | null;
  /** Current viewport state (for zoom/scroll adjustments) */
  viewport?: ViewportState | null;
  /** Callback when user accepts the AI result (passes selected image index) */
  onAccept?: (selectedIndex: number) => void;
  /** Callback when user rejects the AI result */
  onReject?: () => void;
  /** Whether to render review images (set false if rendering externally) */
  renderReviewImages?: boolean;
}

/**
 * ThinkingOverlay Component
 *
 * Displays an animated gradient border and shimmer particles when the AI is processing.
 * Covers the entire excalidraw canvas area.
 *
 * Features:
 * - Rotating warm red/orange glow border
 * - Shimmer particles floating across the canvas
 * - Initial flash wash when thinking starts
 * - Green/red flash for accepted/rejected states
 */
export const ThinkingOverlay: React.FC<ThinkingOverlayProps> = ({
  status,
  showBorder = true,
  image = null,
  iterationImages = [],
  originalImage = null,
  imageWidth,
  imageHeight,
  canvasBounds,
  viewport,
  onAccept,
  onReject,
  renderReviewImages = true,
}) => {
  // Track flash animation state
  const [showFlash, setShowFlash] = useState(false);
  const prevStatusRef = useRef<ThinkingStatus>("idle");

  // Track which iteration image is being viewed
  const [reviewIndex, setReviewIndex] = useState(0);

  // Opacity for AI result overlay (0 = show original, 100 = show AI result)
  const [aiOpacity, setAiOpacity] = useState(100);

  // Track newly arrived images for drop-in animation
  const [newImages, setNewImages] = useState<NewImageState[]>([]);
  const prevImageCountRef = useRef(0);

  // Show chooser panel when we have images (during thinking or reviewing)
  const showChooserPanel = iterationImages.length > 0 && (status === "thinking" || status === "reviewing");

  // Track new images arriving and auto-select the newest one
  useEffect(() => {
    const prevCount = prevImageCountRef.current;
    const newCount = iterationImages.length;

    if (newCount > prevCount) {
      // New image(s) arrived - mark them for animation
      const newImageIndices: NewImageState[] = [];
      for (let i = prevCount; i < newCount; i++) {
        newImageIndices.push({ index: i, timestamp: Date.now() });
      }
      setNewImages(prev => [...prev, ...newImageIndices]);

      // Auto-select the newest image
      setReviewIndex(newCount - 1);

      // Clear animation state after animation completes
      const timer = setTimeout(() => {
        setNewImages(prev => prev.filter(img => Date.now() - img.timestamp < 800));
      }, 800);

      prevImageCountRef.current = newCount;
      return () => clearTimeout(timer);
    }

    prevImageCountRef.current = newCount;
  }, [iterationImages.length]);

  // Reset state when status changes to idle
  useEffect(() => {
    if (status === "idle") {
      setNewImages([]);
      prevImageCountRef.current = 0;
      setReviewIndex(0);
    }
  }, [status]);

  // Trigger flash when transitioning to thinking
  useEffect(() => {
    if (status === "thinking" && prevStatusRef.current !== "thinking") {
      setShowFlash(true);
      const timer = setTimeout(() => setShowFlash(false), 700);
      return () => clearTimeout(timer);
    }
    prevStatusRef.current = status;
  }, [status]);

  // Generate shimmer particles with randomized positions
  const particles = useMemo(() => {
    if (status !== "thinking") {
      return [];
    }

    return Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      animationDelay: Math.random() * 2,
      animationDuration: 1.5 + Math.random() * 1.5,
      size: 4 + Math.random() * 6,
    }));
  }, [status]);

  // Get the canvas container offset from viewport
  // This is needed because ThinkingOverlay uses position:fixed (viewport-relative)
  // but canvas coordinates assume (0,0) is at the canvas origin
  const [canvasOffset, setCanvasOffset] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const updateCanvasOffset = () => {
      // Try multiple selectors to find the actual canvas area
      const selectors = [
        ".excalidraw .excalidraw-container",
        ".excalidraw",
        "[data-testid='excalidraw-container']",
      ];

      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          const rect = element.getBoundingClientRect();
          setCanvasOffset({ top: rect.top, left: rect.left });
          return;
        }
      }
    };

    // Update immediately
    updateCanvasOffset();

    // Also update on a short delay in case DOM isn't ready
    const timer = setTimeout(updateCanvasOffset, 100);

    return () => clearTimeout(timer);
  }, [status]); // Re-check when status changes (overlay becomes visible)

  // Calculate screen position and size for the interim image
  // When we have canvas bounds and viewport, position the image to match the canvas location
  const imageStyle = useMemo(() => {
    // Use imageWidth/imageHeight from props or from canvasBounds
    const imgW = imageWidth ?? canvasBounds?.imageWidth;
    const imgH = imageHeight ?? canvasBounds?.imageHeight;

    if (!canvasBounds || !viewport || !imgW || !imgH) {
      // Fallback to centered positioning if we don't have canvas info
      return undefined;
    }

    // The exported image top-left corner is at (minX - exportPadding, minY - exportPadding) in canvas space
    const canvasX = canvasBounds.minX - canvasBounds.exportPadding;
    const canvasY = canvasBounds.minY - canvasBounds.exportPadding;

    // Convert canvas coordinates to screen coordinates
    // Formula: screenX = (canvasX + scrollX) * zoom
    // Then add canvas container offset since we're using position:fixed
    const screenX =
      (canvasX + viewport.scrollX) * viewport.zoom + canvasOffset.left;
    const screenY =
      (canvasY + viewport.scrollY) * viewport.zoom + canvasOffset.top;

    // Scale the image dimensions by zoom
    const screenWidth = imgW * viewport.zoom;
    const screenHeight = imgH * viewport.zoom;

    return {
      left: `${screenX}px`,
      top: `${screenY}px`,
      width: `${screenWidth}px`,
      height: `${screenHeight}px`,
    } as React.CSSProperties;
  }, [canvasBounds, viewport, imageWidth, imageHeight, canvasOffset]);

  // Don't render if status is idle
  if (status === "idle") {
    return null;
  }

  // Determine the border class based on status
  let borderClass = "thinking-overlay__border";
  if (status === "thinking" && showBorder) {
    borderClass += " thinking-overlay__border--thinking";
  } else if (status === "accepted") {
    borderClass += " thinking-overlay__border--accepted";
  } else if (status === "rejected") {
    borderClass += " thinking-overlay__border--rejected";
  }

  const shouldRenderBorder =
    (status !== "thinking" && status !== "reviewing") || showBorder;

  // Wrapper class with flash state
  const wrapperClass = `thinking-overlay${
    showFlash && showBorder ? " thinking-overlay--flash" : ""
  }`;

  return (
    <>
      {/* Main overlay container for border, sparkles, flash */}
      <div className={wrapperClass}>
        {/* Semi-transparent interim proposal image (during thinking) */}
        {status === "thinking" && image && (
          <img
            src={image}
            alt="AI iteration preview"
            className={`thinking-overlay__image${
              imageStyle ? " thinking-overlay__image--positioned" : ""
            }`}
            style={imageStyle}
          />
        )}

        {/* Initial flash wash effect */}
        <div className="thinking-overlay__flash" />

        {/* Animated gradient border with rotating glow */}
        {shouldRenderBorder && <div className={borderClass} />}

        {/* Shimmer particles (only during thinking) */}
        {status === "thinking" && (
          <div className="thinking-overlay__particles">
            {particles.map((particle) => (
              <div
                key={particle.id}
                className="thinking-overlay__particle"
                style={{
                  left: `${particle.left}%`,
                  top: `${particle.top}%`,
                  width: `${particle.size}px`,
                  height: `${particle.size}px`,
                  animationDelay: `${particle.animationDelay}s`,
                  animationDuration: `${particle.animationDuration}s`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Image chooser panel - shown during both thinking (with images) and reviewing */}
      {showChooserPanel && renderReviewImages && (
        <>
          {/* Original marked-up image (z-index 10, below AI result) */}
          {originalImage && (
            <img
              src={originalImage}
              alt="Original with markups"
              className={`thinking-overlay__image thinking-overlay__image--reviewing thinking-overlay__image--original${
                imageStyle ? " thinking-overlay__image--positioned" : ""
              }`}
              style={{
                ...imageStyle,
                zIndex: 10,
              }}
            />
          )}

          {/* AI result image (z-index 20, with controlled opacity) */}
          <img
            src={iterationImages[reviewIndex]}
            alt={`AI result ${reviewIndex + 1} of ${iterationImages.length}`}
            className={`thinking-overlay__image thinking-overlay__image--reviewing thinking-overlay__image--ai-result${
              imageStyle ? " thinking-overlay__image--positioned" : ""
            }${newImages.some(img => img.index === reviewIndex) ? " thinking-overlay__image--new" : ""}`}
            style={{
              ...imageStyle,
              zIndex: 20,
              opacity: aiOpacity / 100,
            }}
          />

          {/* Chooser panel (z-index 100) */}
          <div className={`thinking-overlay__review-panel${status === "thinking" ? " thinking-overlay__review-panel--collecting" : ""}`}>
            {/* Thumbnail strip - shows all iteration images */}
            <div className="thinking-overlay__thumbnails">
              {iterationImages.map((imgSrc, index) => {
                const isNew = newImages.some(img => img.index === index);
                const isSelected = index === reviewIndex;
                return (
                  <button
                    key={index}
                    type="button"
                    className={`thinking-overlay__thumbnail${isSelected ? " thinking-overlay__thumbnail--selected" : ""}${isNew ? " thinking-overlay__thumbnail--new" : ""}`}
                    onClick={() => setReviewIndex(index)}
                    aria-label={`View iteration ${index + 1}`}
                    aria-pressed={isSelected}
                  >
                    <img src={imgSrc} alt={`Iteration ${index + 1}`} />
                    {isNew && <div className="thinking-overlay__thumbnail-sparkle" />}
                  </button>
                );
              })}
              {/* Placeholder for incoming images during thinking */}
              {status === "thinking" && (
                <div className="thinking-overlay__thumbnail thinking-overlay__thumbnail--placeholder">
                  <div className="thinking-overlay__thumbnail-spinner" />
                </div>
              )}
            </div>

            {/* Opacity comparison slider */}
            <div className="thinking-overlay__comparison">
              <span className="thinking-overlay__comparison-label">
                {originalImage ? "Original" : "(no original)"}
              </span>
              <input
                type="range"
                min="0"
                max="100"
                value={aiOpacity}
                onChange={(e) => setAiOpacity(Number(e.target.value))}
                className="thinking-overlay__comparison-slider"
                aria-label="Compare original and AI result"
              />
              <span className="thinking-overlay__comparison-label">
                AI
              </span>
            </div>

            {/* Accept/Reject buttons - shown when images are available */}
            {iterationImages.length > 0 && (
              <div className="thinking-overlay__actions">
                {onReject && (
                  <button
                    type="button"
                    className="thinking-overlay__action thinking-overlay__action--reject"
                    onClick={onReject}
                    aria-label="Reject AI result"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    <span>Reject</span>
                  </button>
                )}
                {onAccept && (
                  <button
                    type="button"
                    className="thinking-overlay__action thinking-overlay__action--accept"
                    onClick={() => onAccept(reviewIndex)}
                    aria-label="Accept AI result"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Accept</span>
                  </button>
                )}
              </div>
            )}

            {/* Processing indicator during thinking */}
            {status === "thinking" && (
              <div className="thinking-overlay__processing-hint">
                Generating more options...
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
};

export default ThinkingOverlay;
