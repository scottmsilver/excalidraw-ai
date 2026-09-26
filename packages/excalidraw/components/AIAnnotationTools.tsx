import {
  ArrowToolButton,
  EllipseToolButton,
  FreedrawToolButton,
  HandToolButton,
  isToolButtonDisabled,
  RectangleToolButton,
  SelectionToolButton,
  TextToolButton,
} from "./Tools";
import { IconButton } from "./IconButton";
import { polygonIcon } from "./icons";

import type { AppClassProperties, UIAppState } from "../types";

export const AIAnnotationHint = ({
  polygonSelected = false,
}: {
  polygonSelected?: boolean;
}) => (
  <p className="AI-annotation-hint">
    Mark up instructions for AI. Accept a result to change your image.
    <br />
    {polygonSelected
      ? "Polygon: click each corner, then the first point to close."
      : "Shift+click adds a reference marker."}
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
      <IconButton
        type="toggle"
        icon={polygonIcon}
        checked={activeTool.type === "line"}
        disabled={isToolButtonDisabled(app, "line")}
        aria-label="Polygon"
        title="Polygon — click each corner, then the first point to close"
        data-testid="toolbar-polygon"
        onSelect={({ pointerType }) => {
          if (!app.state.penDetected && pointerType === "pen") {
            app.togglePenMode(true);
          }
          app.setActiveTool({ type: "line" });
          app.api.updateScene({ appState: { currentItemRoundness: "sharp" } });
        }}
      />
      <FreedrawToolButton {...toolProps} />
      <TextToolButton {...toolProps} />
    </div>
  );
};
