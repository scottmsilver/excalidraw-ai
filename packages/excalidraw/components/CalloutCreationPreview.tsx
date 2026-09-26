import {
  ROUNDNESS,
  getLineHeight,
  sceneCoordsToViewportCoords,
} from "@excalidraw/common";
import { getApproxMinLineHeight, getCornerRadius } from "@excalidraw/element";
import { getCalloutPlacement } from "@excalidraw/element/calloutCreation";
import { perimeterRatioToPoint } from "@excalidraw/element/callout";

import { atom, useAtom } from "../editor-jotai";

import "./CalloutCreationPreview.scss";

import type { AppState } from "../types";

type Point = readonly [number, number];

export type CalloutCreation = {
  phase: "leader" | "awaiting-box" | "box";
  tip: Point;
  leaderEnd: Point;
  boxStart?: Point;
  boxEnd?: Point;
  dragged?: boolean;
  pointerId?: number;
  clientStart?: Point;
};

export const calloutCreationAtom = atom<CalloutCreation | null>(null);

export const CalloutCreationPreview = ({
  appState,
}: {
  appState: AppState;
}) => {
  const [creation] = useAtom(calloutCreationAtom);
  if (!creation) {
    return appState.activeTool.type === "callout" ? (
      <div className="callout-creation-hint">
        Drag from the subject to start the arrow.
      </div>
    ) : null;
  }

  const toLocal = (point: Point) => {
    const { x, y } = sceneCoordsToViewportCoords(
      { sceneX: point[0], sceneY: point[1] },
      appState,
    );
    return [x - appState.offsetLeft, y - appState.offsetTop] as const;
  };
  const tip = toLocal(creation.tip);
  let end = toLocal(creation.leaderEnd);
  let box: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
  } | null = null;
  if (creation.phase === "box" && creation.boxStart && creation.boxEnd) {
    const roundness =
      appState.currentItemRoundness === "round"
        ? ({ type: ROUNDNESS.ADAPTIVE_RADIUS } as const)
        : null;
    const placement = getCalloutPlacement(
      creation.tip,
      creation.boxStart,
      creation.boxEnd,
      !!creation.dragged,
      roundness,
      getApproxMinLineHeight(
        appState.currentItemFontSize,
        getLineHeight(appState.currentItemFontFamily),
      ),
    );
    const attachment = perimeterRatioToPoint(
      placement.tailAttachment,
      placement.width,
      placement.height,
      roundness,
    );
    end = toLocal([placement.x + attachment[0], placement.y + attachment[1]]);
    const topLeft = toLocal([placement.x, placement.y]);
    box = {
      x: topLeft[0],
      y: topLeft[1],
      width: placement.width * appState.zoom.value,
      height: placement.height * appState.zoom.value,
      radius:
        getCornerRadius(Math.min(placement.width, placement.height), {
          roundness,
        }) * appState.zoom.value,
    };
  }

  return (
    <div className="callout-creation-preview">
      <svg width="100%" height="100%" aria-hidden="true">
        <line
          data-testid="callout-creation-leader"
          x1={tip[0]}
          y1={tip[1]}
          x2={end[0]}
          y2={end[1]}
          stroke="var(--color-primary)"
          strokeWidth="2"
          markerStart="url(#callout-creation-arrow)"
        />
        <defs>
          <marker
            id="callout-creation-arrow"
            markerWidth="9"
            markerHeight="9"
            refX="2"
            refY="4.5"
            orient="auto"
          >
            <path
              d="M 9 0 L 0 4.5 L 9 9"
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="1.5"
            />
          </marker>
        </defs>
        {box && (
          <rect
            x={box.x}
            y={box.y}
            width={box.width}
            height={box.height}
            rx={box.radius}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="2"
            strokeDasharray="5 4"
          />
        )}
      </svg>
      {creation.phase === "awaiting-box" && (
        <div className="callout-creation-hint">
          Arrow set. Press where the arrow joins the box; drag to size.
        </div>
      )}
    </div>
  );
};
