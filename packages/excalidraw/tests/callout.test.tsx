import React from "react";
import { fireEvent } from "@testing-library/react";

import { KEYS, MQ_MIN_WIDTH_DESKTOP } from "@excalidraw/common";
import { exportToSvg } from "@excalidraw/utils";
import {
  getElementBounds,
  getNonDeletedElements,
  newCalloutElement,
} from "@excalidraw/element";
import { pointFrom, type LocalPoint } from "@excalidraw/math";
import {
  getCalloutTailTipGlobalCoords,
  getCalloutTailPoints,
} from "@excalidraw/element/callout";
import { redrawTextBoundingBox } from "@excalidraw/element/textElement";
import { getTransformHandles } from "@excalidraw/element/transformHandles";
import { resizeSingleElement } from "@excalidraw/element/resizeElements";
import { dragSelectedElements } from "@excalidraw/element/dragElements";

import { moveElement } from "../components/Stats/utils";

import { Excalidraw } from "../index";
import { restoreElements } from "../data/restore";

import { API } from "./helpers/api";
import { getTextEditor, updateTextEditor } from "./queries/dom";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { act, render, screen, unmountComponent } from "./test-utils";
import { GlobalTestState } from "./test-utils";

import type { PointerDownState } from "../types";

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

  it("keeps the arrow as a preview and explains box placement after the first release", () => {
    Keyboard.keyPress(KEYS.C);
    mouse.downAt(100, 100);
    mouse.moveTo(180, 160);
    mouse.up();

    expect(getNonDeletedElements(h.elements)).toHaveLength(0);
    expect(
      screen.getByText("Arrow set. Drag to place the callout."),
    ).toBeVisible();
    expect(screen.getByTestId("callout-creation-leader")).toBeVisible();
    expect(h.state.activeTool.type).toBe("callout");
  });

  it("places a box with a reverse drag while keeping the arrow tip fixed", async () => {
    Keyboard.keyPress(KEYS.C);
    mouse.downAt(100, 100);
    mouse.moveTo(190, 150);
    mouse.up();
    mouse.downAt(400, 300);
    mouse.moveTo(240, 200);
    mouse.up();

    const callout = h.elements[0] as ReturnType<typeof newCalloutElement>;
    expect(callout).toMatchObject({ x: 240, y: 200, width: 160, height: 100 });
    expect(getCalloutTailTipGlobalCoords(callout)).toEqual([100, 100]);
    expect(
      screen.queryByText("Arrow set. Drag to place the callout."),
    ).toBeNull();
    Keyboard.exitTextEditor(await getTextEditor());
  });

  it("cancels the preview with Escape before or during box placement", () => {
    Keyboard.keyPress(KEYS.C);
    mouse.downAt(100, 100);
    mouse.up();
    Keyboard.keyPress(KEYS.ESCAPE);
    expect(
      screen.queryByText("Arrow set. Drag to place the callout."),
    ).toBeNull();
    expect(h.elements).toHaveLength(0);

    mouse.downAt(100, 100);
    mouse.up();
    mouse.downAt(200, 200);
    mouse.moveTo(300, 300);
    Keyboard.keyPress(KEYS.ESCAPE);
    mouse.up();
    expect(h.elements).toHaveLength(0);
  });

  it("cancels a pointer that the browser takes over", () => {
    Keyboard.keyPress(KEYS.C);
    mouse.downAt(100, 100);
    fireEvent.pointerCancel(GlobalTestState.interactiveCanvas, {
      pointerId: 1,
      pointerType: "mouse",
      clientX: 100,
      clientY: 100,
    });
    expect(h.elements).toHaveLength(0);
    expect(screen.queryByTestId("callout-creation-leader")).toBeNull();
  });

  it("cancels when switching tools while waiting for the box", () => {
    Keyboard.keyPress(KEYS.C);
    mouse.downAt(100, 100);
    mouse.up();
    act(() => h.app.setActiveTool({ type: "selection" }));
    expect(screen.queryByTestId("callout-creation-leader")).toBeNull();
    expect(h.elements).toHaveLength(0);
  });

  it("uses a default box for a second click", async () => {
    Keyboard.keyPress(KEYS.C);
    mouse.clickAt(100, 100);
    mouse.clickAt(240, 200);
    const callout = h.elements[0] as ReturnType<typeof newCalloutElement>;
    expect(callout).toMatchObject({ x: 240, y: 200, width: 160, height: 100 });
    expect(getCalloutTailTipGlobalCoords(callout)).toEqual([100, 100]);
    Keyboard.exitTextEditor(await getTextEditor());
  });

  it("starts either gesture over an existing shape", async () => {
    UI.createElement("rectangle", { x: 80, y: 80, width: 180, height: 140 });
    Keyboard.keyPress(KEYS.C);
    mouse.downAt(100, 100);
    mouse.moveTo(180, 150);
    mouse.up();
    mouse.downAt(140, 120);
    mouse.moveTo(340, 250);
    mouse.up();
    expect(
      getNonDeletedElements(h.elements).filter(
        (element) => element.type === "callout",
      ),
    ).toHaveLength(1);
    Keyboard.exitTextEditor(await getTextEditor());
  });

  it("creates one undoable callout only after the second release", async () => {
    Keyboard.keyPress(KEYS.C);
    mouse.downAt(100, 100);
    mouse.moveTo(190, 150);
    mouse.up();
    expect(h.elements).toHaveLength(0);
    mouse.downAt(240, 200);
    mouse.moveTo(400, 300);
    mouse.up();
    Keyboard.exitTextEditor(await getTextEditor());
    expect(getNonDeletedElements(h.elements)).toHaveLength(1);
    Keyboard.undo();
    expect(getNonDeletedElements(h.elements)).toHaveLength(0);
  });

  it("cancels when a second touch begins during placement", () => {
    const firstTouch = new Pointer("touch", 31);
    const secondTouch = new Pointer("touch", 32);
    Keyboard.keyPress(KEYS.C);
    firstTouch.downAt(100, 100);
    firstTouch.up();
    firstTouch.downAt(240, 200);
    secondTouch.downAt(260, 220);
    firstTouch.up();
    secondTouch.up();
    expect(h.elements).toHaveLength(0);
    expect(screen.queryByTestId("callout-creation-leader")).toBeNull();
  });

  it("exposes the toolbar tool and creates a callout with C", async () => {
    expect(screen.getByTestId("toolbar-callout")).toBeTruthy();
    Keyboard.keyPress(KEYS.C);
    expect(h.state.activeTool.type).toBe("callout");
    mouse.downAt(100, 100);
    mouse.moveTo(260, 180);
    mouse.up();
    mouse.downAt(260, 180);
    mouse.moveTo(420, 260);
    mouse.up();
    Keyboard.exitTextEditor(await getTextEditor());
    expect(getNonDeletedElements(h.elements)).toHaveLength(1);
    expect(h.elements[0].type).toBe("callout");
    const restored = restoreElements(
      JSON.parse(JSON.stringify(getNonDeletedElements(h.elements))),
      null,
    );
    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({
      type: "callout",
      x: 260,
      y: 180,
      width: 160,
      height: 80,
    });
    expect(restored[0]).toMatchObject({
      tailTip: expect.any(Object),
      tailAttachment: expect.any(Number),
    });
  });

  it.each([false, true])(
    "focuses text immediately after drawing a callout (tool locked: %s)",
    async (locked) => {
      Keyboard.keyPress(KEYS.C);
      API.setAppState({ activeTool: { ...h.state.activeTool, locked } });
      mouse.downAt(100, 100);
      mouse.moveTo(260, 180);
      mouse.up();
      mouse.downAt(260, 180);
      mouse.moveTo(420, 260);
      mouse.up();
      const editor = await getTextEditor();
      expect(document.activeElement).toBe(editor);
      updateTextEditor(editor, "Type immediately");
      Keyboard.exitTextEditor(editor);
      expect(h.state.activeTool.type).toBe(locked ? "callout" : "selection");
      expect(h.state.activeTool.locked).toBe(locked);
      expect(
        h.elements.find((element) => element.type === "text"),
      ).toMatchObject({
        originalText: "Type immediately",
        containerId: h.elements[0].id,
      });
    },
  );

  it("focuses text after click-to-place creation", async () => {
    Keyboard.keyPress(KEYS.C);
    mouse.downAt(100, 100);
    mouse.up();
    mouse.downAt(220, 180);
    mouse.up();
    expect(document.activeElement).toBe(await getTextEditor());
    expect(h.state.editingTextElement?.containerId).toBe(h.elements[0].id);
  });

  it("starts each new callout in box-only mode", () => {
    API.setAppState({ calloutSelectionMode: "whole" });
    Keyboard.keyPress(KEYS.C);
    mouse.downAt(300, 300);
    mouse.moveTo(460, 380);
    mouse.up();
    mouse.downAt(460, 380);
    mouse.moveTo(620, 460);
    mouse.up();
    expect(h.state.calloutSelectionMode).toBe("box");
  });

  it("keeps the world tip fixed when nudging a selected rotated box", () => {
    const callout = newCalloutElement({
      type: "callout",
      x: 100,
      y: 100,
      width: 160,
      height: 80,
      angle: 0.6 as any,
    });
    API.setElements([callout]);
    API.setSelectedElements([callout]);
    const before = getCalloutTailTipGlobalCoords(callout);
    Keyboard.keyPress(KEYS.ARROW_RIGHT);
    const after = getCalloutTailTipGlobalCoords(
      h.elements[0] as typeof callout,
    );
    expect(h.elements[0].x).toBe(101);
    expect(after[0]).toBeCloseTo(before[0], 8);
    expect(after[1]).toBeCloseTo(before[1], 8);
  });

  it.each(["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const)(
    "anchors the tip resizing the %s handle",
    (handle) => {
      const callout = newCalloutElement({
        type: "callout",
        x: 300,
        y: 300,
        width: 160,
        height: 80,
        angle: 0.6 as any,
        tailTip: pointFrom<LocalPoint>(400, 200),
      });
      API.setElements([callout]);
      API.setSelectedElements([callout]);
      const before = getCalloutTailTipGlobalCoords(callout);
      UI.resize(callout, handle, [35, 25]);
      expect(h.state.editingTextElement).toBeNull();
      const after = getCalloutTailTipGlobalCoords(
        h.elements[0] as typeof callout,
      );
      expect(after[0]).toBeCloseTo(before[0], 8);
      expect(after[1]).toBeCloseTo(before[1], 8);
    },
  );

  it("anchors the tip rotating the box", () => {
    const callout = newCalloutElement({
      type: "callout",
      x: 300,
      y: 300,
      width: 160,
      height: 80,
      tailTip: pointFrom<LocalPoint>(400, 200),
    });
    API.setElements([callout]);
    API.setSelectedElements([callout]);
    const before = getCalloutTailTipGlobalCoords(callout);
    UI.rotate(callout, [45, 40]);
    const after = getCalloutTailTipGlobalCoords(
      h.elements[0] as typeof callout,
    );
    expect(after[0]).toBeCloseTo(before[0], 8);
    expect(after[1]).toBeCloseTo(before[1], 8);
  });

  it("anchors the tip dragging the box", () => {
    const callout = newCalloutElement({
      type: "callout",
      x: 300,
      y: 300,
      width: 160,
      height: 80,
      tailTip: pointFrom<LocalPoint>(400, 200),
    });
    API.setElements([callout]);
    API.setSelectedElements([callout]);
    const before = getCalloutTailTipGlobalCoords(callout);
    mouse.downAt(350, 330);
    mouse.moveTo(390, 360);
    mouse.up();
    const after = getCalloutTailTipGlobalCoords(
      h.elements[0] as typeof callout,
    );
    expect(h.elements[0].x).toBe(340);
    expect(h.state.editingTextElement).toBeNull();
    expect(after[0]).toBeCloseTo(before[0], 8);
    expect(after[1]).toBeCloseTo(before[1], 8);
  });

  it("anchors the tip when bound text grows a rotated box", () => {
    const callout = newCalloutElement({
      type: "callout",
      x: 300,
      y: 300,
      width: 160,
      height: 40,
      angle: 0.6 as any,
      boundElements: [{ id: "callout-text", type: "text" }],
    });
    const text = API.createElement({
      type: "text",
      id: "callout-text",
      containerId: callout.id,
      text: "a\nb\nc\nd\ne\nf\ng",
    });
    API.setElements([callout, text]);
    const before = getCalloutTailTipGlobalCoords(callout);
    act(() => redrawTextBoundingBox(text, callout, h.app.scene));
    expect(callout.height).toBeGreaterThan(40);
    const after = getCalloutTailTipGlobalCoords(callout);
    expect(after[0]).toBeCloseTo(before[0], 8);
    expect(after[1]).toBeCloseTo(before[1], 8);
  });

  it("anchors the target through text editor growth and shrinkage", async () => {
    const callout = newCalloutElement({
      type: "callout",
      x: 300,
      y: 300,
      width: 160,
      height: 80,
      angle: 0.6 as any,
    });
    API.setElements([callout]);
    API.setSelectedElements([callout]);
    const before = getCalloutTailTipGlobalCoords(callout);
    mouse.doubleClickAt(380, 340);
    const editor = await getTextEditor();
    updateTextEditor(editor, "one\ntwo\nthree\nfour\nfive\nsix\nseven\neight");
    const grown = h.elements.find(
      (el) => el.id === callout.id,
    ) as typeof callout;
    const grownHeight = grown.height;
    expect(grownHeight).toBeGreaterThan(80);
    expect(getCalloutTailTipGlobalCoords(grown)[0]).toBeCloseTo(before[0], 8);
    expect(getCalloutTailTipGlobalCoords(grown)[1]).toBeCloseTo(before[1], 8);
    updateTextEditor(editor, "one");
    const shrunk = h.elements.find(
      (el) => el.id === callout.id,
    ) as typeof callout;
    expect(shrunk.height).toBeLessThan(grownHeight);
    expect(getCalloutTailTipGlobalCoords(shrunk)[0]).toBeCloseTo(before[0], 8);
    expect(getCalloutTailTipGlobalCoords(shrunk)[1]).toBeCloseTo(before[1], 8);
    Keyboard.exitTextEditor(editor);
  });

  it("anchors a tiny rotated callout when entering its first text edit", async () => {
    const callout = newCalloutElement({
      type: "callout",
      x: 300,
      y: 300,
      width: 5,
      height: 5,
      angle: 0.6 as any,
    });
    API.setElements([callout]);
    API.setSelectedElements([callout]);
    const before = getCalloutTailTipGlobalCoords(callout);
    mouse.doubleClickAt(302.5, 302.5);
    const editor = await getTextEditor();
    expect(callout.height).toBeGreaterThan(5);
    expect(getCalloutTailTipGlobalCoords(callout)[0]).toBeCloseTo(before[0], 8);
    expect(getCalloutTailTipGlobalCoords(callout)[1]).toBeCloseTo(before[1], 8);
    Keyboard.exitTextEditor(editor);
  });

  it("keeps a whole resize affine when its text enforces a minimum box size", () => {
    const callout = newCalloutElement({
      type: "callout",
      x: 300,
      y: 300,
      width: 160,
      height: 80,
      tailTip: pointFrom<LocalPoint>(50, 240),
      tailCurve: 0,
      boundElements: [{ id: "label", type: "text" }],
    });
    const label = API.createElement({
      type: "text",
      id: "label",
      containerId: callout.id,
      text: "some words that wrap over several lines",
      fontSize: 20,
    });
    API.setElements([callout, label]);
    API.setSelectedElements([callout]);
    API.setAppState({ calloutSelectionMode: "whole" });
    UI.resize(callout, "se", [-70, -120]);
    const result = h.elements[0] as typeof callout;
    expect(result.tailTip[0] / result.width).toBeCloseTo(50 / 160, 8);
    expect(result.tailTip[1] / result.height).toBeCloseTo(3, 8);
  });

  it("selects the whole callout by its shaft, then the box by its interior", () => {
    const callout = newCalloutElement({
      type: "callout",
      x: 300,
      y: 300,
      width: 160,
      height: 80,
      tailTip: pointFrom<LocalPoint>(80, 240),
      tailCurve: 0,
      tailAttachment: 2 / 3,
    });
    API.setElements([callout]);
    expect(h.app.hitElement(380, 460, callout)).toBe(true);
    mouse.downAt(380, 460);
    expect(h.state.selectedElementIds[callout.id]).toBe(true);
    mouse.up();
    expect(h.state.selectedElementIds[callout.id]).toBe(true);
    expect(h.state.calloutSelectionMode).toBe("whole");
    expect(
      (screen.getByLabelText("Box + arrow") as HTMLInputElement).checked,
    ).toBe(true);
    mouse.clickAt(350, 330);
    expect(h.state.calloutSelectionMode).toBe("box");
    expect(
      (screen.getByLabelText("Box only") as HTMLInputElement).checked,
    ).toBe(true);
  });

  it("moves both box and tip when nudging in whole mode", () => {
    const callout = newCalloutElement({
      type: "callout",
      x: 300,
      y: 300,
      width: 160,
      height: 80,
    });
    API.setElements([callout]);
    API.setSelectedElements([callout]);
    API.setAppState({ calloutSelectionMode: "whole" });
    const before = getCalloutTailTipGlobalCoords(callout);
    Keyboard.keyPress(KEYS.ARROW_RIGHT);
    const after = getCalloutTailTipGlobalCoords(
      h.elements[0] as typeof callout,
    );
    expect(after[0]).toBeCloseTo(before[0] + 1, 8);
    expect(after[1]).toBeCloseTo(before[1], 8);
  });

  it("drags the entire selected callout after choosing Box + arrow", () => {
    const callout = newCalloutElement({
      type: "callout",
      x: 300,
      y: 300,
      width: 160,
      height: 80,
      tailTip: pointFrom<LocalPoint>(50, 240),
    });
    API.setElements([callout]);
    API.setSelectedElements([callout]);
    fireEvent.click(screen.getByLabelText("Box + arrow"));
    expect(h.state.calloutSelectionMode).toBe("whole");
    const before = getCalloutTailTipGlobalCoords(callout);
    mouse.downAt(350, 330);
    mouse.moveTo(400, 360);
    mouse.up();
    expect(callout.x).toBe(350);
    expect(callout.y).toBe(330);
    expect(getCalloutTailTipGlobalCoords(callout)).toEqual([
      before[0] + 50,
      before[1] + 30,
    ]);
    expect(h.state.calloutSelectionMode).toBe("whole");
    mouse.clickAt(390, 360);
    expect(h.state.calloutSelectionMode).toBe("box");
  });

  it("treats a grouped callout as a whole object even in box mode", () => {
    const callout = newCalloutElement({
      type: "callout",
      x: 300,
      y: 300,
      width: 160,
      height: 80,
      groupIds: ["group"],
      tailTip: pointFrom<LocalPoint>(50, 240),
      tailCurve: 0,
    });
    API.setElements([callout]);
    API.setSelectedElements([callout]);
    UI.resize(callout, "se", [160, 240]);
    const result = h.elements[0] as typeof callout;
    expect(result.tailTip[0] / result.width).toBeCloseTo(50 / 160, 8);
    expect(result.tailTip[1] / result.height).toBeCloseTo(3, 8);
  });

  it("keeps a locked callout unchanged on nudge and tip drag", () => {
    const callout = newCalloutElement({
      type: "callout",
      x: 300,
      y: 300,
      width: 160,
      height: 80,
      locked: true,
      tailTip: pointFrom<LocalPoint>(80, 240),
    });
    API.setElements([callout]);
    API.setSelectedElements([callout]);
    Keyboard.keyPress(KEYS.ARROW_RIGHT);
    mouse.downAt(380, 540);
    mouse.moveTo(420, 570);
    mouse.up();
    expect(h.elements[0]).toMatchObject({
      x: 300,
      y: 300,
      width: 160,
      height: 80,
      tailTip: [80, 240],
    });
  });

  it("uses the tail-inclusive frame for whole callout handles", () => {
    const callout = newCalloutElement({
      type: "callout",
      x: 300,
      y: 300,
      width: 160,
      height: 80,
      tailTip: pointFrom<LocalPoint>(80, 240),
      tailCurve: 0,
      tailArrowhead: null,
    });
    const handles = getTransformHandles(
      callout,
      h.state.zoom,
      new Map([[callout.id, callout]]),
      "mouse",
      {},
      "whole",
    );
    expect(handles.se![1]).toBeGreaterThan(530);
  });

  it("resizes the box and tip by the same whole-callout affine transform", () => {
    const callout = newCalloutElement({
      type: "callout",
      x: 300,
      y: 300,
      width: 160,
      height: 80,
      tailTip: pointFrom<LocalPoint>(80, 240),
      tailCurve: 0,
      tailArrowhead: null,
    });
    API.setElements([callout]);
    API.setSelectedElements([callout]);
    API.setAppState({ calloutSelectionMode: "whole" });
    UI.resize(callout, "se", [160, 240]);
    const result = h.elements[0] as typeof callout;
    const tip = getCalloutTailTipGlobalCoords(result);
    expect(result.width / 160).toBeCloseTo((tip[0] - 300) / 80, 8);
    expect(result.height / 80).toBeCloseTo((tip[1] - 300) / 240, 8);
    expect(result.width).toBeGreaterThan(160);
    expect(result.width).toBeCloseTo(320, 8);
    expect(result.height).toBeCloseTo(160, 8);
  });

  it("rotates the whole callout around its tail-inclusive center", () => {
    const callout = newCalloutElement({
      type: "callout",
      x: 300,
      y: 300,
      width: 160,
      height: 80,
      tailTip: pointFrom<LocalPoint>(80, 240),
      tailCurve: 0,
      tailArrowhead: null,
    });
    API.setElements([callout]);
    API.setSelectedElements([callout]);
    API.setAppState({ calloutSelectionMode: "whole" });
    UI.rotate(callout, [90, 70]);
    const result = h.elements[0] as typeof callout;
    const tip = getCalloutTailTipGlobalCoords(result);
    expect(result.angle).not.toBe(0);
    expect(Math.hypot(tip[0] - 380, tip[1] - 420)).toBeCloseTo(120, 6);
    expect(
      Math.hypot(
        result.x + result.width / 2 - 380,
        result.y + result.height / 2 - 420,
      ),
    ).toBeCloseTo(80, 6);
  });

  it.each(["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const)(
    "scales a rotated whole callout from the %s handle",
    (handle) => {
      const callout = newCalloutElement({
        type: "callout",
        x: 300,
        y: 300,
        width: 160,
        height: 80,
        angle: 0.6 as any,
        tailTip: pointFrom<LocalPoint>(50, 240),
        tailCurve: 0,
      });
      API.setElements([callout]);
      API.setSelectedElements([callout]);
      API.setAppState({ calloutSelectionMode: "whole" });
      UI.resize(callout, handle, [35, 25]);
      const result = h.elements[0] as typeof callout;
      expect([result.width, result.height]).not.toEqual([160, 80]);
      expect(result.tailTip[0] / result.width).toBeCloseTo(50 / 160, 8);
      expect(result.tailTip[1] / result.height).toBeCloseTo(3, 8);
    },
  );

  it("drags the tip explicitly in whole mode even on a selection border", () => {
    const callout = newCalloutElement({
      type: "callout",
      x: 300,
      y: 300,
      width: 160,
      height: 80,
      tailTip: pointFrom<LocalPoint>(80, 240),
      tailCurve: 0,
    });
    API.setElements([callout]);
    API.setSelectedElements([callout]);
    API.setAppState({ calloutSelectionMode: "whole" });
    mouse.downAt(380, 540);
    mouse.moveTo(420, 570);
    mouse.up();
    const result = h.elements[0] as typeof callout;
    expect(result.x).toBe(300);
    expect(result.y).toBe(300);
    expect(result.width).toBe(160);
    expect(result.height).toBe(80);
    expect(getCalloutTailTipGlobalCoords(result)).toEqual([420, 570]);
  });

  it.each(["position", "dimension"])(
    "anchors the tip in the %s property editor",
    (property) => {
      const callout = newCalloutElement({
        type: "callout",
        x: 300,
        y: 300,
        width: 160,
        height: 80,
        angle: 0.6 as any,
      });
      API.setElements([callout]);
      API.setSelectedElements([callout]);
      const original = { ...callout };
      const originals = new Map([[callout.id, original]]);
      const before = getCalloutTailTipGlobalCoords(callout);
      act(() => {
        if (property === "position") {
          moveElement(450, 400, original, h.scene, h.state, originals);
        } else {
          resizeSingleElement(
            200,
            130,
            callout,
            original,
            originals,
            h.scene,
            "nw",
          );
        }
      });
      const after = getCalloutTailTipGlobalCoords(callout);
      expect(after[0]).toBeCloseTo(before[0], 8);
      expect(after[1]).toBeCloseTo(before[1], 8);
    },
  );

  it("scales the target with a multi-selection", () => {
    const callout = newCalloutElement({
      type: "callout",
      x: 300,
      y: 300,
      width: 160,
      height: 80,
      tailTip: pointFrom<LocalPoint>(80, 240),
      tailCurve: 0,
    });
    const rectangle = API.createElement({
      type: "rectangle",
      x: 500,
      y: 300,
      width: 100,
      height: 80,
    });
    API.setElements([callout, rectangle]);
    const before = getCalloutTailTipGlobalCoords(callout);
    UI.resize([callout, rectangle], "se", [150, 120]);
    const result = h.elements[0] as typeof callout;
    const after = getCalloutTailTipGlobalCoords(result);
    expect(after[0] - result.x).toBeCloseTo(
      ((before[0] - 300) * result.width) / 160,
      8,
    );
    expect(after[1] - result.y).toBeCloseTo(
      ((before[1] - 300) * result.height) / 80,
      8,
    );
  });

  it("moves the target with its selected containing frame", () => {
    const frame = API.createElement({
      type: "frame",
      x: 200,
      y: 200,
      width: 500,
      height: 400,
    });
    const callout = newCalloutElement({
      type: "callout",
      x: 300,
      y: 300,
      width: 160,
      height: 80,
      frameId: frame.id,
    });
    API.setElements([frame, callout]);
    API.setSelectedElements([frame]);
    const before = getCalloutTailTipGlobalCoords(callout);
    const pointerDownState = {
      originalElements: new Map(
        h.elements.map((element) => [element.id, { ...element }]),
      ),
    } as PointerDownState;
    act(() =>
      dragSelectedElements(
        pointerDownState,
        [frame],
        { x: 50, y: 40 },
        h.scene,
        { x: 0, y: 0 },
        null,
        "box",
      ),
    );
    expect(callout.x).toBe(350);
    expect(callout.y).toBe(340);
    expect(getCalloutTailTipGlobalCoords(callout)).toEqual([
      before[0] + 50,
      before[1] + 40,
    ]);
  });

  it("hits the rendered resize handles of a grouped callout pointing up-left", () => {
    const callout = newCalloutElement({
      type: "callout",
      x: 300,
      y: 300,
      width: 160,
      height: 80,
      groupIds: ["group"],
      tailTip: pointFrom<LocalPoint>(-180, -140),
      tailCurve: 0,
    });
    API.setElements([callout]);
    API.setSelectedElements([callout]);
    UI.resize(callout, "w", [-100, 0]);
    expect(callout.width).toBeGreaterThan(160);
    UI.rotate(callout, [40, 20]);
    expect(callout.angle).not.toBe(0);
  });

  it("scales grouped callout targets through numeric dimensions", () => {
    const callout = newCalloutElement({
      type: "callout",
      x: 300,
      y: 300,
      width: 160,
      height: 80,
      groupIds: ["group"],
      tailTip: pointFrom<LocalPoint>(50, 240),
      tailCurve: 0,
    });
    API.setElements([callout]);
    API.setSelectedElements([callout]);
    const original = { ...callout };
    act(() =>
      resizeSingleElement(
        320,
        160,
        callout,
        original,
        new Map([[callout.id, original]]),
        h.scene,
        "se",
      ),
    );
    expect(callout.tailTip).toEqual([100, 480]);
  });

  it("reflects the attachment edge with a multi-selection flip", () => {
    const callout = newCalloutElement({
      type: "callout",
      x: 300,
      y: 300,
      width: 100,
      height: 100,
      tailAttachment: 0.375,
      tailTip: pointFrom<LocalPoint>(200, 50),
      tailCurve: 0,
    });
    const rectangle = API.createElement({
      type: "rectangle",
      x: 550,
      y: 300,
      width: 100,
      height: 100,
    });
    API.setElements([callout, rectangle]);
    UI.resize([callout, rectangle], "se", [-700, 0]);
    expect(getCalloutTailPoints(callout).attachPoint[0]).toBeCloseTo(0, 8);
  });

  it("anchors the tip when editing the angle property", () => {
    const callout = newCalloutElement({
      type: "callout",
      x: 300,
      y: 300,
      width: 160,
      height: 80,
    });
    API.setElements([callout]);
    API.setSelectedElements([callout]);
    API.setAppState({ stats: { open: true, panels: 255 } });
    const before = getCalloutTailTipGlobalCoords(callout);
    const input = UI.queryStatsProperty("A")!.querySelector(
      ".drag-input",
    ) as HTMLInputElement;
    UI.updateInput(input, "60");
    const after = getCalloutTailTipGlobalCoords(callout);
    expect(after[0]).toBeCloseTo(before[0], 8);
    expect(after[1]).toBeCloseTo(before[1], 8);
  });

  it("offsets the entire callout during an alt-drag duplicate", () => {
    const callout = newCalloutElement({
      type: "callout",
      x: 300,
      y: 300,
      width: 160,
      height: 80,
    });
    API.setElements([callout]);
    API.setSelectedElements([callout]);
    const before = getCalloutTailTipGlobalCoords(callout);
    Keyboard.withModifierKeys({ alt: true }, () => {
      mouse.downAt(350, 330);
      mouse.moveTo(400, 370);
      mouse.up();
    });
    expect(h.elements).toHaveLength(2);
    for (const element of h.elements) {
      const tip = getCalloutTailTipGlobalCoords(element as typeof callout);
      expect(tip[0]).toBeCloseTo(before[0] + element.x - 300, 8);
      expect(tip[1]).toBeCloseTo(before[1] + element.y - 300, 8);
    }
  });

  it("replays stored tip geometry regardless of the current selection mode", async () => {
    Keyboard.keyPress(KEYS.C);
    mouse.downAt(300, 300);
    mouse.moveTo(460, 380);
    mouse.up();
    mouse.downAt(460, 380);
    mouse.moveTo(620, 460);
    mouse.up();
    Keyboard.exitTextEditor(await getTextEditor());
    const callout = h.elements[0] as ReturnType<typeof newCalloutElement>;
    const before = {
      x: callout.x,
      y: callout.y,
      width: callout.width,
      height: callout.height,
      angle: callout.angle,
      tailTip: [...callout.tailTip],
    };
    UI.resize(callout, "nw", [30, 20]);
    const current = h.elements[0] as typeof callout;
    const after = {
      x: current.x,
      y: current.y,
      width: current.width,
      height: current.height,
      angle: current.angle,
      tailTip: [...current.tailTip],
    };
    API.setAppState({ calloutSelectionMode: "whole" });
    Keyboard.undo();
    expect(h.elements[0]).toMatchObject(before);
    API.setAppState({ calloutSelectionMode: "box" });
    Keyboard.redo();
    expect(h.elements[0]).toMatchObject(after);
    expect(
      restoreElements(JSON.parse(JSON.stringify(h.elements)), null)[0],
    ).toMatchObject(after);
  });

  it.each([
    ["horizontal", -320, 0],
    ["vertical", 0, -480],
    ["both", -320, -480],
  ] as const)(
    "flips the whole callout %s across its resize anchor",
    (_, dx, dy) => {
      const callout = newCalloutElement({
        type: "callout",
        x: 300,
        y: 300,
        width: 160,
        height: 80,
        tailTip: pointFrom<LocalPoint>(80, 240),
        tailCurve: 0,
      });
      API.setElements([callout]);
      API.setSelectedElements([callout]);
      API.setAppState({ calloutSelectionMode: "whole" });
      UI.resize(callout, "se", [dx, dy]);
      const result = h.elements[0] as typeof callout;
      const tip = getCalloutTailTipGlobalCoords(result);
      expect(result.width).toBeGreaterThan(1);
      expect(result.height).toBeGreaterThan(1);
      expect((tip[0] - 300) / 80).toBeCloseTo(
        ((dx < 0 ? -1 : 1) * result.width) / 160,
        8,
      );
      expect((tip[1] - 300) / 240).toBeCloseTo(
        ((dy < 0 ? -1 : 1) * result.height) / 80,
        8,
      );
    },
  );

  it("exports the callout body and tail to SVG", async () => {
    Keyboard.keyPress(KEYS.C);
    mouse.downAt(100, 100);
    mouse.moveTo(260, 180);
    mouse.up();
    mouse.downAt(260, 180);
    mouse.moveTo(420, 260);
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
      calloutAutoStyle: {
        foreground: false,
        background: false,
        opacity: false,
      },
    });
    const svg = await exportToSvg({
      elements: getNonDeletedElements([element]),
      appState: h.state,
      files: {},
    });
    const callout = svg.querySelector(`[data-id="${element.id}"]`)!;
    // Outline, curved tail, two crowfoot strokes and the cardinality bar.
    // A separate fill path is allowed for background-only opacity.
    expect(
      callout.querySelectorAll('path[stroke]:not([stroke="none"])'),
    ).toHaveLength(5);
  });
});
