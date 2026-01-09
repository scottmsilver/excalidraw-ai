/**
 * ManipulationDialog Component
 *
 * A dialog for entering natural language commands for AI-assisted image manipulation.
 * Displays reference point indicators, accepts command text, and shows progress
 * during AI processing.
 *
 * Features:
 * - Text input for commands (e.g., "Move A to B")
 * - Reference point indicators showing which points are placed
 * - Submit/Cancel buttons with proper disabled states
 * - Loading state with progress from SSE events
 * - Error display with retry capability
 */

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from "react";

import { executeAgenticEdit } from "../../services/agenticService";
import { aiLogService } from "../../../excalidraw-app/ai/aiLogService";
import { canvasToImage } from "../../utils/coordinateTransforms";
import { useAIManipulation } from "../../providers/AIManipulationProvider";

import type { ReferencePoint } from "../ReferencePoints";

import type { ManipulationDialogProps, ManipulationDialogState } from "./types";
import type { AIProgressEvent } from "../../services/types";

// =============================================================================
// Constants
// =============================================================================

const INITIAL_STATE: ManipulationDialogState = {
  command: "",
  isLoading: false,
  currentStep: "idle",
  progressMessage: "",
  error: null,
  iteration: undefined,
};

/**
 * Color palette for marker indicators - matches ReferencePointMarker colors
 */
const MARKER_COLORS = [
  "#E53935", // Red
  "#1E88E5", // Blue
  "#43A047", // Green
  "#FB8C00", // Orange
  "#8E24AA", // Purple
  "#00ACC1", // Cyan
] as const;

// =============================================================================
// Styles (inline for now, can be extracted to CSS/module later)
// =============================================================================

const styles = {
  overlay: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  dialog: {
    backgroundColor: "#fff",
    borderRadius: "8px",
    padding: "24px",
    minWidth: "400px",
    maxWidth: "600px",
    maxHeight: "90vh",
    overflow: "auto",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
  },
  previewContainer: {
    marginBottom: "16px",
    border: "1px solid #ddd",
    borderRadius: "6px",
    overflow: "hidden",
    backgroundColor: "#f5f5f5",
    position: "relative" as const,
  },
  previewImageWrapper: {
    position: "relative" as const,
  },
  previewImage: {
    width: "100%",
    maxHeight: "300px",
    objectFit: "contain" as const,
    display: "block",
  },
  previewLabel: {
    padding: "8px 12px",
    backgroundColor: "#f0f0f0",
    fontSize: "12px",
    color: "#666",
    borderBottom: "1px solid #ddd",
  },
  title: {
    margin: "0 0 16px 0",
    fontSize: "18px",
    fontWeight: 600,
    color: "#333",
  },
  section: {
    marginBottom: "16px",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    fontSize: "14px",
    fontWeight: 500,
    color: "#555",
  },
  pointsContainer: {
    display: "flex",
    gap: "8px",
    marginBottom: "16px",
  },
  pointIndicator: (backgroundColor: string, isHovered: boolean) => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    fontSize: "14px",
    fontWeight: 600,
    backgroundColor,
    color: "#fff",
    transition: "all 0.2s ease",
    cursor: "pointer",
    transform: isHovered ? "scale(1.15)" : "scale(1)",
    boxShadow: isHovered ? "0 2px 8px rgba(0,0,0,0.3)" : "none",
  }),
  previewMarker: (backgroundColor: string) => ({
    position: "absolute" as const,
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    backgroundColor,
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: 600,
    transform: "translate(-50%, -50%)",
    boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
    border: "2px solid #fff",
    zIndex: 10,
    pointerEvents: "none" as const,
  }),
  previewMarkerCoords: {
    position: "absolute" as const,
    backgroundColor: "rgba(0,0,0,0.75)",
    color: "#fff",
    padding: "2px 6px",
    borderRadius: "4px",
    fontSize: "10px",
    fontFamily: "monospace",
    whiteSpace: "nowrap" as const,
    transform: "translate(-50%, 4px)",
    zIndex: 10,
    pointerEvents: "none" as const,
  },
  textArea: {
    width: "100%",
    minHeight: "80px",
    padding: "12px",
    border: "1px solid #ddd",
    borderRadius: "6px",
    fontSize: "14px",
    fontFamily: "inherit",
    resize: "vertical" as const,
    boxSizing: "border-box" as const,
  },
  progressContainer: {
    padding: "12px",
    backgroundColor: "#f5f5f5",
    borderRadius: "6px",
    marginBottom: "16px",
  },
  progressText: {
    margin: 0,
    fontSize: "13px",
    color: "#666",
  },
  iterationText: {
    margin: "4px 0 0 0",
    fontSize: "12px",
    color: "#888",
  },
  errorContainer: {
    padding: "12px",
    backgroundColor: "#ffebee",
    borderRadius: "6px",
    marginBottom: "16px",
    border: "1px solid #ffcdd2",
  },
  errorText: {
    margin: 0,
    fontSize: "13px",
    color: "#c62828",
  },
  buttonContainer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
  },
  button: (isPrimary: boolean, isDisabled: boolean) => ({
    padding: "10px 20px",
    border: "none",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: 500,
    cursor: isDisabled ? "not-allowed" : "pointer",
    opacity: isDisabled ? 0.6 : 1,
    backgroundColor: isPrimary ? "#1976D2" : "#e0e0e0",
    color: isPrimary ? "#fff" : "#333",
    transition: "all 0.2s ease",
  }),
  spinner: {
    display: "inline-block",
    width: "16px",
    height: "16px",
    border: "2px solid #fff",
    borderTopColor: "transparent",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    marginRight: "8px",
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the color for a marker based on its index
 */
function getMarkerColor(index: number): string {
  return MARKER_COLORS[index % MARKER_COLORS.length];
}

/**
 * Get a human-readable message for the current step
 */
function getStepMessage(step: string): string {
  switch (step) {
    case "planning":
      return "Planning the edit...";
    case "calling_api":
      return "Generating image...";
    case "processing":
      return "Processing result...";
    case "self_checking":
      return "Checking result quality...";
    case "iterating":
      return "Refining the edit...";
    case "complete":
      return "Complete!";
    case "error":
      return "An error occurred";
    default:
      return "Processing...";
  }
}

// =============================================================================
// Component
// =============================================================================

export const ManipulationDialog: React.FC<ManipulationDialogProps> = ({
  isOpen,
  onClose,
  referencePoints,
  canvasBlob,
  onResult,
  exportBounds,
}) => {
  // Get context setters for syncing progress state to ThinkingOverlay
  const { setIsProcessing, setProgress } = useAIManipulation();

  const [state, setState] = useState<ManipulationDialogState>(INITIAL_STATE);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<ReferencePoint | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{
    natural: { width: number; height: number };
    displayed: { width: number; height: number };
  } | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setState(INITIAL_STATE);
      setHoveredPoint(null);
    }
  }, [isOpen]);

  // Convert canvasBlob to data URL for preview
  useEffect(() => {
    if (!canvasBlob) {
      setPreviewUrl(null);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(canvasBlob);

    return () => {
      reader.abort();
    };
  }, [canvasBlob]);

  // Handle image load to get dimensions
  const handleImageLoad = useCallback(() => {
    if (imageRef.current) {
      setImageDimensions({
        natural: {
          width: imageRef.current.naturalWidth,
          height: imageRef.current.naturalHeight,
        },
        displayed: {
          width: imageRef.current.clientWidth,
          height: imageRef.current.clientHeight,
        },
      });
    }
  }, []);

  // Calculate transformed reference points (canvas coords → image coords)
  const transformedPoints = useMemo(() => {
    if (!exportBounds) {
      return referencePoints;
    }
    return referencePoints.map((point) => {
      const imageCoords = canvasToImage(
        { x: point.x, y: point.y },
        exportBounds,
      );
      return { ...point, x: imageCoords.x, y: imageCoords.y };
    });
  }, [referencePoints, exportBounds]);

  // Calculate marker position on the displayed image
  const getMarkerDisplayPosition = useCallback(
    (point: ReferencePoint) => {
      if (!imageDimensions || !exportBounds) {
        return null;
      }

      // Get the transformed coordinates (canvas → image)
      const imageCoords = canvasToImage(
        { x: point.x, y: point.y },
        exportBounds,
      );
      const imageX = imageCoords.x;
      const imageY = imageCoords.y;

      // Calculate scale factor between natural and displayed image
      // object-fit: contain maintains aspect ratio, so we need to account for letterboxing
      const naturalAspect =
        imageDimensions.natural.width / imageDimensions.natural.height;
      const displayedAspect =
        imageDimensions.displayed.width / imageDimensions.displayed.height;

      let scale: number;
      let offsetX = 0;
      let offsetY = 0;

      if (naturalAspect > displayedAspect) {
        // Image is wider than container - letterboxed top/bottom
        scale = imageDimensions.displayed.width / imageDimensions.natural.width;
        const scaledHeight = imageDimensions.natural.height * scale;
        offsetY = (imageDimensions.displayed.height - scaledHeight) / 2;
      } else {
        // Image is taller than container - letterboxed left/right
        scale =
          imageDimensions.displayed.height / imageDimensions.natural.height;
        const scaledWidth = imageDimensions.natural.width * scale;
        offsetX = (imageDimensions.displayed.width - scaledWidth) / 2;
      }

      return {
        x: imageX * scale + offsetX,
        y: imageY * scale + offsetY,
      };
    },
    [imageDimensions, exportBounds],
  );

  // Reference points are now used directly (no longer need to check against hardcoded labels)

  // Refs to accumulate streaming text (deltas)
  const accumulatedThinkingRef = useRef<string>("");
  const accumulatedRawOutputRef = useRef<string>("");
  // Ref to preserve iterationImage across progress events (it only comes once per iteration)
  const lastIterationImageRef = useRef<string | null>(null);

  // Check if submit should be enabled
  const canSubmit =
    !state.isLoading &&
    state.command.trim().length > 0 &&
    referencePoints.length > 0 &&
    canvasBlob !== null;

  /**
   * Handle progress events from SSE stream
   * Supports both full text (thinkingText, rawOutput) and deltas (thinkingTextDelta, rawOutputDelta)
   */
  const handleProgress = useCallback(
    (event: AIProgressEvent) => {
      // Handle thinking text - either full or delta
      let thinkingText = event.thinkingText;
      if (event.thinkingTextDelta) {
        accumulatedThinkingRef.current += event.thinkingTextDelta;
        thinkingText = accumulatedThinkingRef.current;
      } else if (event.thinkingText) {
        // Full text replaces accumulated
        accumulatedThinkingRef.current = event.thinkingText;
      }

      // Handle raw output - either full or delta
      let rawOutput = event.rawOutput;
      if (event.rawOutputDelta) {
        accumulatedRawOutputRef.current += event.rawOutputDelta;
        rawOutput = accumulatedRawOutputRef.current;
      } else if (event.rawOutput) {
        // Full text replaces accumulated
        accumulatedRawOutputRef.current = event.rawOutput;
      }

      // Preserve iterationImage across events - update ref if new image arrives
      if (event.iterationImage) {
        lastIterationImageRef.current = event.iterationImage;
      }

      // Sync progress to provider for ThinkingOverlay
      // Use the preserved iterationImage if the current event doesn't have one
      setProgress({
        ...event,
        iterationImage:
          event.iterationImage || lastIterationImageRef.current || undefined,
      });

      // Log to aiLogService for sidebar display
      aiLogService.updateOperation({
        step: event.step,
        message: event.message || getStepMessage(event.step),
        iteration: event.iteration,
        thinkingText,
        prompt: event.prompt,
        rawOutput,
        inputImages: event.inputImages,
        iterationImage: event.iterationImage,
      });

      setState((prev) => ({
        ...prev,
        currentStep: event.step,
        progressMessage: event.message || getStepMessage(event.step),
        iteration: event.iteration,
      }));
    },
    [setProgress],
  );

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !canvasBlob) {
      return;
    }

    // Reset accumulated text and images for new operation
    accumulatedThinkingRef.current = "";
    accumulatedRawOutputRef.current = "";
    lastIterationImageRef.current = null;

    // Transform reference points from canvas coordinates to image coordinates
    // if exportBounds is provided
    const transformedReferencePoints = exportBounds
      ? referencePoints.map((point) => {
          const imageCoords = canvasToImage(
            { x: point.x, y: point.y },
            exportBounds,
          );
          return { ...point, x: imageCoords.x, y: imageCoords.y };
        })
      : referencePoints;

    // Start logging operation
    aiLogService.startOperation(
      "planning",
      `AI Edit: "${state.command.trim()}"`,
    );

    // Set processing state for ThinkingOverlay
    setIsProcessing(true);

    // Close dialog immediately - progress will show in sidebar
    onClose();

    try {
      await executeAgenticEdit({
        canvasBlob,
        referencePoints: transformedReferencePoints,
        command: state.command.trim(),
        onProgress: handleProgress,
      });

      // End logging operation
      aiLogService.endOperation("complete", "Edit complete!");

      // Don't call onResult here - the review UI will handle accept/reject
      // The result images are collected via onProgress → addIterationImage
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred";

      // End logging operation with error
      aiLogService.endOperation("error", errorMessage, {
        message: errorMessage,
        details: error instanceof Error ? error.stack : undefined,
      });

      // Show error (could add toast notification here in future)
      console.error("AI Edit failed:", errorMessage);
    } finally {
      // Clear processing state
      setIsProcessing(false);
    }
  }, [
    canSubmit,
    canvasBlob,
    state.command,
    referencePoints,
    exportBounds,
    handleProgress,
    onClose,
    setIsProcessing,
  ]);

  /**
   * Handle cancel button
   */
  const handleCancel = useCallback(() => {
    if (!state.isLoading) {
      onClose();
    }
  }, [state.isLoading, onClose]);

  /**
   * Handle command text change
   */
  const handleCommandChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setState((prev) => ({
        ...prev,
        command: e.target.value,
        error: null, // Clear error when user types
      }));
    },
    [],
  );

  /**
   * Handle Enter key to submit (Shift+Enter for newline)
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey && canSubmit) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [canSubmit, handleSubmit],
  );

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Keyframe animation for spinner */}
      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>

      {/* Overlay */}
      <div
        style={styles.overlay}
        onClick={handleCancel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manipulation-dialog-title"
      >
        {/* Dialog container - stop propagation to prevent close on click inside */}
        <div
          style={styles.dialog}
          onClick={(e) => e.stopPropagation()}
          role="document"
        >
          {/* Title */}
          <h2 id="manipulation-dialog-title" style={styles.title}>
            AI Image Manipulation
          </h2>

          {/* Canvas Preview Section */}
          {previewUrl && (
            <div style={styles.previewContainer}>
              <div style={styles.previewLabel}>Image being sent to AI</div>
              <div style={styles.previewImageWrapper}>
                <img
                  ref={imageRef}
                  src={previewUrl}
                  alt="Canvas preview"
                  style={styles.previewImage}
                  onLoad={handleImageLoad}
                />
                {/* Hover marker on preview image */}
                {hoveredPoint &&
                  imageDimensions &&
                  (() => {
                    const pos = getMarkerDisplayPosition(hoveredPoint);
                    if (!pos) {
                      return null;
                    }
                    const transformedPoint = transformedPoints.find(
                      (p) => p.id === hoveredPoint.id,
                    );
                    return (
                      <>
                        <div
                          style={{
                            ...styles.previewMarker(
                              getMarkerColor(hoveredPoint.index),
                            ),
                            left: pos.x,
                            top: pos.y,
                          }}
                        >
                          {hoveredPoint.label}
                        </div>
                        {transformedPoint && (
                          <div
                            style={{
                              ...styles.previewMarkerCoords,
                              left: pos.x,
                              top: pos.y + 12,
                            }}
                          >
                            ({Math.round(transformedPoint.x)},{" "}
                            {Math.round(transformedPoint.y)})
                          </div>
                        )}
                      </>
                    );
                  })()}
              </div>
            </div>
          )}

          {/* Reference Points Section */}
          <div style={styles.section}>
            <label style={styles.label}>
              Reference Points (hover to see position)
            </label>
            <div style={styles.pointsContainer}>
              {referencePoints.map((point) => (
                <div
                  key={point.id}
                  style={styles.pointIndicator(
                    getMarkerColor(point.index),
                    hoveredPoint?.id === point.id,
                  )}
                  title={`Point ${point.label} - hover to see position on image`}
                  onMouseEnter={() => setHoveredPoint(point)}
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  {point.label}
                </div>
              ))}
            </div>
            {referencePoints.length === 0 && (
              <p style={{ margin: 0, fontSize: "12px", color: "#888" }}>
                Place at least one reference point on the canvas before
                submitting.
              </p>
            )}
          </div>

          {/* Command Input Section */}
          <div style={styles.section}>
            <label htmlFor="command-input" style={styles.label}>
              Command
            </label>
            <textarea
              id="command-input"
              style={styles.textArea}
              value={state.command}
              onChange={handleCommandChange}
              onKeyDown={handleKeyDown}
              placeholder='Enter your command (e.g., "Move A to B", "Make A look like C")'
              disabled={state.isLoading}
              autoFocus
            />
          </div>

          {/* Progress Display */}
          {state.isLoading && (
            <div style={styles.progressContainer}>
              <p style={styles.progressText}>
                <span style={styles.spinner} />
                {state.progressMessage}
              </p>
              {state.iteration && (
                <p style={styles.iterationText}>
                  Iteration {state.iteration.current} of {state.iteration.max}
                </p>
              )}
            </div>
          )}

          {/* Error Display */}
          {state.error && (
            <div style={styles.errorContainer}>
              <p style={styles.errorText}>{state.error}</p>
            </div>
          )}

          {/* Buttons */}
          <div style={styles.buttonContainer}>
            <button
              type="button"
              style={styles.button(false, state.isLoading)}
              onClick={handleCancel}
              disabled={state.isLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              style={styles.button(true, !canSubmit)}
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {state.isLoading ? "Processing..." : "Submit"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ManipulationDialog;
