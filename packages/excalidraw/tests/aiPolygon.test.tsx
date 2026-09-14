import React from "react";

import type { ExcalidrawLinearElement } from "@excalidraw/element/types";

import { extractShapesFromElements } from "../../../src/utils/shapeExtractor";

import { Excalidraw } from "../index";

import { Pointer } from "./helpers/ui";
import { act, fireEvent, render } from "./test-utils";

describe.each([
  { formFactor: "desktop", pointerType: "mouse" },
  { formFactor: "phone", pointerType: "touch" },
  { formFactor: "tablet", pointerType: "pen" },
] as const)(
  "AI polygon on $formFactor with $pointerType",
  ({ formFactor, pointerType }) => {
    it("draws straight segments, closes at the first point, and exports closed guidance", async () => {
      const ui = await render(
        <Excalidraw
          editingMode="ai"
          UIOptions={{ getFormFactor: () => formFactor }}
        />,
      );
      act(() => window.h.setState({ currentItemRoundness: "round" }));
      fireEvent.click(ui.getByRole("button", { name: "Polygon" }));
      expect(window.h.state.activeTool.type).toBe("line");
      expect(window.h.state.currentItemRoundness).toBe("sharp");

      const mouse = new Pointer(pointerType);
      for (const [x, y] of [
        [100, 100],
        [250, 100],
        [200, 250],
        [100, 100],
      ]) {
        if (pointerType === "mouse") {
          mouse.moveTo(x, y);
        }
        mouse.clickAt(x, y);
      }
      const elements = window.h.elements.filter(
        (element) => !element.isDeleted,
      );
      expect(elements).toHaveLength(1);
      const polygon = elements[0] as ExcalidrawLinearElement;
      expect(polygon.type).toBe("line");
      expect(polygon.roundness).toBeNull();
      expect(polygon.points).toHaveLength(4);
      expect(polygon.points[0]).toEqual(polygon.points[3]);
      expect(window.h.state.multiElement).toBeNull();

      const [shape] = extractShapesFromElements(elements, {
        minX: 0,
        minY: 0,
        exportPadding: 10,
        imageWidth: 300,
        imageHeight: 300,
      });
      expect(shape.isClosed).toBe(true);
      expect(shape.isCurved).not.toBe(true);
      expect(shape.points).toHaveLength(4);
      expect(shape.points?.[0]).toEqual(shape.points?.[3]);
    });

    if (pointerType !== "mouse") {
      it("keeps tap-to-create line behavior in normal Edit mode", async () => {
        await render(
          <Excalidraw UIOptions={{ getFormFactor: () => formFactor }} />,
        );
        act(() => {
          window.h.setState({ width: 1000 });
          window.h.app.setActiveTool({ type: "line" });
        });
        const pointer = new Pointer(pointerType);
        pointer.clickAt(100, 100);
        expect(window.h.app.editorInterface.isTouchScreen).toBe(true);
        expect(window.h.state.multiElement).toBeNull();
        const line = window.h.elements[0] as ExcalidrawLinearElement;
        expect(line.points).toHaveLength(2);
        expect(line.points[1][0]).toBeGreaterThan(0);
      });
    }
  },
);
