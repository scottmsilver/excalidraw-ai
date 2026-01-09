/**
 * AI Mode Types
 *
 * Types for the AI tool mode system that allows users to place
 * reference markers on the canvas using Shift+Click.
 */

/**
 * State for the AI mode system
 */
export interface AIToolState {
  /** Whether AI mode is currently active */
  isActive: boolean;
}

/**
 * Actions available for AI mode management
 */
export interface AIToolActions {
  /** Enter AI mode (activates Shift+Click marker placement) */
  enterAIMode: () => void;
  /** Exit AI mode (returns to normal canvas interaction) */
  exitAIMode: () => void;
}

/**
 * Result of the useAIMode hook
 */
export interface UseAIModeResult extends AIToolActions {
  /** Whether AI mode is currently active */
  isActive: boolean;
}
