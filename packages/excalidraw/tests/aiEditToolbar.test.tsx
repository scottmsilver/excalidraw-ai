import React from "react";

import { Excalidraw } from "../index";

import { act, fireEvent, render } from "./test-utils";

describe.each(["desktop", "phone"] as const)(
  "AI Edit toolbar on %s",
  (formFactor) => {
    it("replaces editing controls with annotation tools and restores them on exit", async () => {
      const ui = await render(
        <Excalidraw
          editingMode="ai"
          UIOptions={{ getFormFactor: () => formFactor }}
        />,
      );

      expect(
        ui.getByRole("toolbar", { name: "AI annotation tools" }),
      ).toBeTruthy();
      expect(ui.queryByTestId("toolbar-image")).toBeNull();
      expect(ui.queryByTestId("toolbar-eraser")).toBeNull();
      fireEvent.click(ui.getByTestId("toolbar-rectangle"));
      expect(window.h.state.activeTool.type).toBe("rectangle");

      await act(async () => {
        ui.rerender(
          <Excalidraw
            editingMode="edit"
            UIOptions={{ getFormFactor: () => formFactor }}
          />,
        );
      });
      expect(
        ui.queryByRole("toolbar", { name: "AI annotation tools" }),
      ).toBeNull();
      expect(ui.getByTestId("toolbar-eraser")).toBeTruthy();
    });
  },
);
