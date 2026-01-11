/**
 * ManipulationDialog Types
 *
 * Types for the AI manipulation dialog component that allows users
 * to enter natural language commands for AI-assisted image editing.
 */

import type { ReferencePoint } from "../ReferencePoints";
import type { AIProgressEvent, AIProgressStep, ShapeMetadata } from "../../services/types";
import type { ExportBounds } from "../../utils/coordinateTransforms";

// Re-export ExportBounds for consumers
export type { ExportBounds };

/**
 * Props for the ManipulationDialog component
 */
export interface ManipulationDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback to close the dialog */
  onClose: () => void;
  /** Reference points placed by the user (unlimited: A, B, C, ... Z, AA, AB, ...) */
  referencePoints: ReferencePoint[];
  /** User-drawn shapes/annotations for AI context */
  shapes?: ShapeMetadata[];
  /** Clean source image as Blob (original without annotations - this is what gets edited) */
  cleanImageBlob: Blob | null;
  /** Annotated image as Blob (with user's drawings visible for AI guidance) */
  annotatedImageBlob: Blob | null;
  /** Callback when AI operation completes with result image */
  onResult: (resultImage: string) => void;
  /**
   * Export bounds for coordinate transformation.
   * Used to convert canvas coordinates to image coordinates.
   */
  exportBounds?: ExportBounds;
}

/**
 * Internal state for the dialog
 */
export interface ManipulationDialogState {
  /** The user's command text */
  command: string;
  /** Whether the AI is currently processing */
  isLoading: boolean;
  /** Current step in the AI workflow */
  currentStep: AIProgressStep;
  /** Progress message to display */
  progressMessage: string;
  /** Error message if operation failed */
  error: string | null;
  /** Current iteration info */
  iteration?: {
    current: number;
    max: number;
  };
}

/**
 * Reference point indicator for display in the dialog
 * @deprecated No longer used - dialog now renders points directly
 */
export interface ReferencePointIndicator {
  label: string;
  isPlaced: boolean;
}

// Re-export types that consumers might need
export type { AIProgressEvent, AIProgressStep };
