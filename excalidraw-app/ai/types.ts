/**
 * AI Progress tracking types for streaming progress updates during AI operations
 */

/**
 * Progress step enum representing the current phase of AI operation
 */
export type AIProgressStep =
  | "idle" // No operation in progress
  | "planning" // Agent is planning the edit (high thinking budget)
  | "calling_api" // Making API call to generative model
  | "processing" // Processing API response
  | "self_checking" // Agent is evaluating the result
  | "iterating" // Preparing for next iteration
  | "complete" // Operation completed successfully
  | "error"; // Operation failed

/**
 * An input image sent to the AI (for full transparency logging)
 */
export interface AIInputImage {
  /** Label describing what this image is (e.g., "Original Image", "Edited Result", "Mask") */
  label: string;
  /** Base64 data URL of the image */
  dataUrl: string;
}

/**
 * A single log entry in the AI console
 */
export interface AILogEntry {
  id: string;
  timestamp: number;
  step: AIProgressStep;
  message: string;
  thinkingText?: string;

  // Full transparency fields
  /** The prompt being sent to the AI (system prompt, user prompt, etc) */
  prompt?: string;
  /** Raw text output from the AI (non-thinking response) */
  rawOutput?: string;
  /** All input images sent to the AI for this call */
  inputImages?: AIInputImage[];

  iteration?: {
    current: number;
    max: number;
  };
  error?: {
    message: string;
    details?: string;
  };
  /** Duration in ms (set when operation completes) */
  durationMs?: number;
  /** Generated image from this iteration (base64 data URL) */
  iterationImage?: string;
  /** Debug data for self-check visualization */
  debugData?: {
    originalImage: string; // base64 data URL
    resultImage: string; // base64 data URL
    editRegions: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      centerX: number;
      centerY: number;
      pixelCount: number;
    }>;
    imageWidth: number;
    imageHeight: number;
    totalChangedPixels: number;
    percentChanged: number;
  };
}

/**
 * Current operation state (for timer display, etc.)
 */
export interface AILogState {
  step: AIProgressStep;
  message: string;
  elapsedMs: number;
  isActive: boolean;
}
