/**
 * ManipulationDialog Module
 *
 * A dialog component for AI-assisted image manipulation using natural language commands.
 *
 * @example
 * ```tsx
 * import { ManipulationDialog } from './components/ManipulationDialog';
 *
 * function MyComponent() {
 *   const [isOpen, setIsOpen] = useState(false);
 *   const [referencePoints, setReferencePoints] = useState<ReferencePoint[]>([]);
 *
 *   return (
 *     <ManipulationDialog
 *       isOpen={isOpen}
 *       onClose={() => setIsOpen(false)}
 *       referencePoints={referencePoints}
 *       canvasImage={canvasDataUrl}
 *       onResult={(imageData) => {
 *         applyImageToCanvas(imageData);
 *       }}
 *     />
 *   );
 * }
 * ```
 */

// Main component
export { ManipulationDialog } from "./ManipulationDialog";
export { default } from "./ManipulationDialog";

// Types
export type {
  ManipulationDialogProps,
  ManipulationDialogState,
  ReferencePointIndicator,
  AIProgressEvent,
  AIProgressStep,
} from "./types";
