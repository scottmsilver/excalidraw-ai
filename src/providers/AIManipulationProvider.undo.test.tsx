import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import {
  AIManipulationProvider,
  useAIManipulation,
} from "./AIManipulationProvider";

afterEach(() => vi.useRealTimers());

it("undoes in-place edits without corrupting snapshots or redo", () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useAIManipulation(), {
    wrapper: AIManipulationProvider,
  });
  const element = { id: "annotation", version: 1, x: 0, tailTip: [10, 20] };
  act(() => {
    result.current.initializeAIUndoState([]);
    result.current.pushAIUndoEntry([element]);
    result.current.setElementsSnapshot([element]);
  });
  element.x = 100;
  element.tailTip[0] = 80;
  element.version = 2;
  act(() => result.current.pushAIUndoEntry([element]));
  let restored: readonly unknown[] | null = null;
  act(() => {
    restored = result.current.aiUndo();
  });
  expect(restored).toEqual([
    { id: "annotation", version: 1, x: 0, tailTip: [10, 20] },
  ]);
  expect(result.current.elementsSnapshot).toEqual(restored);
  // The scene may mutate an undo result. Stored history must remain independent.
  (restored![0] as typeof element).tailTip[0] = 999;
  act(() => {
    result.current.aiRedo();
    vi.advanceTimersByTime(51);
  });
  act(() => {
    restored = result.current.aiUndo();
  });
  expect(restored).toEqual([
    { id: "annotation", version: 1, x: 0, tailTip: [10, 20] },
  ]);
});
