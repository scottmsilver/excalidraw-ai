import React from "react";

import { KEYS, MQ_MIN_WIDTH_DESKTOP } from "@excalidraw/common";
import { exportToSvg } from "@excalidraw/utils";
import {
  getElementBounds,
  getNonDeletedElements,
  newCalloutElement,
} from "@excalidraw/element";
import { pointFrom, type LocalPoint } from "@excalidraw/math";

import { Excalidraw } from "../index";
import { restoreElements } from "../data/restore";

import { API } from "./helpers/api";
import { Keyboard, Pointer } from "./helpers/ui";
import { render, screen, unmountComponent } from "./test-utils";

const { h } = window;
const mouse = new Pointer("mouse");

describe("restored callout tool", () => {
  beforeEach(async () => {
    unmountComponent();
    localStorage.clear();
    mouse.reset();
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    API.setAppState({ height: 768, width: MQ_MIN_WIDTH_DESKTOP });
  });

  it("exposes the toolbar tool and creates a callout with C", () => {
    expect(screen.getByTestId("toolbar-callout")).toBeTruthy();
    Keyboard.keyPress(KEYS.C);
    expect(h.state.activeTool.type).toBe("callout");
    mouse.downAt(100, 100);
    mouse.moveTo(260, 180);
    mouse.up();
    expect(h.elements).toHaveLength(1);
    expect(h.elements[0].type).toBe("callout");
    const restored = restoreElements(
      JSON.parse(JSON.stringify(h.elements)),
      null,
    );
    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({
      type: "callout",
      x: 100,
      y: 100,
      width: 160,
      height: 80,
    });
    expect(restored[0]).toMatchObject({
      tailTip: expect.any(Object),
      tailAttachment: expect.any(Number),
    });
  });

  it("exports the callout body and tail to SVG", async () => {
    Keyboard.keyPress(KEYS.C);
    mouse.downAt(100, 100);
    mouse.moveTo(260, 180);
    mouse.up();
    const svg = await exportToSvg({
      elements: getNonDeletedElements(h.elements),
      appState: h.state,
      files: {},
    });
    const callout = svg.querySelector(`[data-id="${h.elements[0].id}"]`);
    expect(callout).not.toBeNull();
    expect(callout!.querySelectorAll("path").length).toBeGreaterThanOrEqual(3);
  });

  it("includes a sideways curved tail in export bounds", () => {
    const element = newCalloutElement({
      type: "callout",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      tailTip: pointFrom<LocalPoint>(1000, 100),
    });
    const bounds = getElementBounds(element, new Map([[element.id, element]]));
    expect(bounds[3]).toBeGreaterThanOrEqual(242.5);
  });

  it.each([
    ["dot", "circle"],
    ["crowfoot_one", "cardinality_one"],
    ["crowfoot_many", "cardinality_many"],
    ["crowfoot_one_or_many", "cardinality_one_or_many"],
  ])("restores legacy %s tail arrowheads as %s", (legacy, normalized) => {
    const callout = newCalloutElement({
      type: "callout",
      x: 0,
      y: 0,
      width: 100,
      height: 80,
    });
    const [restored] = restoreElements(
      [{ ...callout, tailArrowhead: legacy }] as any,
      null,
    );
    expect(restored).toMatchObject({ tailArrowhead: normalized });
  });

  it("renders both parts of the upstream cardinality tail arrowhead", async () => {
    const element = newCalloutElement({
      type: "callout",
      x: 0,
      y: 0,
      width: 100,
      height: 80,
      tailArrowhead: "cardinality_one_or_many",
    });
    const svg = await exportToSvg({
      elements: getNonDeletedElements([element]),
      appState: h.state,
      files: {},
    });
    const callout = svg.querySelector(`[data-id="${element.id}"]`)!;
    // Body, curved tail, two crowfoot strokes and the cardinality bar.
    expect(callout.querySelectorAll("path")).toHaveLength(5);
  });
});
