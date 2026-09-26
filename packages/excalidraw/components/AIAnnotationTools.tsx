import {
  ArrowToolButton,
  EllipseToolButton,
  FreedrawToolButton,
  HandToolButton,
  LineToolButton,
  RectangleToolButton,
  SelectionToolButton,
  TextToolButton,
} from "./Tools";

import type { AppClassProperties, UIAppState } from "../types";

export const AIAnnotationHint = () => (
  <p className="AI-annotation-hint">
    Mark up instructions for AI. Accept a result to change your image.
    <br />
    Shift+click adds a reference marker.
  </p>
);

/** Drawing in this toolbar supplies instructions for the host's AI edit. */
export const AIAnnotationTools = ({
  app,
  activeTool,
}: {
  app: AppClassProperties;
  activeTool: UIAppState["activeTool"];
}) => {
  const toolProps = { app, activeTool };
  return (
    <div
      className="AI-annotation-tools"
      role="toolbar"
      aria-label="AI annotation tools"
    >
      <HandToolButton {...toolProps} hideKeyBinding />
      <SelectionToolButton {...toolProps} />
      <RectangleToolButton {...toolProps} />
      <EllipseToolButton {...toolProps} />
      <ArrowToolButton {...toolProps} />
      <LineToolButton {...toolProps} />
      <FreedrawToolButton {...toolProps} />
      <TextToolButton {...toolProps} />
    </div>
  );
};
