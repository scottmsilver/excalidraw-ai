import { Emitter } from "@excalidraw/common";

import {
  CaptureUpdateAction,
  StoreChange,
  StoreDelta,
} from "@excalidraw/element";

import type { StoreSnapshot, Store } from "@excalidraw/element";

import type { SceneElementsMap } from "@excalidraw/element/types";

import type { AppState } from "./types";

export class HistoryDelta extends StoreDelta {
  /**
   * Apply the delta to the passed elements and appState, does not modify the snapshot.
   */
  public applyTo(
    elements: SceneElementsMap,
    appState: AppState,
    snapshot: StoreSnapshot,
  ): [SceneElementsMap, AppState, boolean] {
    const [nextElements, elementsContainVisibleChange] = this.elements.applyTo(
      elements,
      // used to fallback into local snapshot in case we couldn't apply the delta
      // due to a missing (force deleted) elements in the scene
      snapshot.elements,
      // we don't want to apply the `version` and `versionNonce` properties for history
      // as we always need to end up with a new version due to collaboration,
      // approaching each undo / redo as a new user action
      {
        excludedProperties: new Set(["version", "versionNonce"]),
      },
    );

    const [nextAppState, appStateContainsVisibleChange] = this.appState.applyTo(
      appState,
      nextElements,
    );

    const appliedVisibleChanges =
      elementsContainVisibleChange || appStateContainsVisibleChange;

    return [nextElements, nextAppState, appliedVisibleChanges];
  }

  /**
   * Overriding once to avoid type casting everywhere.
   */
  public static override calculate(
    prevSnapshot: StoreSnapshot,
    nextSnapshot: StoreSnapshot,
  ) {
    return super.calculate(prevSnapshot, nextSnapshot) as HistoryDelta;
  }

  /**
   * Overriding once to avoid type casting everywhere.
   */
  public static override inverse(delta: StoreDelta): HistoryDelta {
    return super.inverse(delta) as HistoryDelta;
  }

  /**
   * Overriding once to avoid type casting everywhere.
   */
  public static override applyLatestChanges(
    delta: StoreDelta,
    prevElements: SceneElementsMap,
    nextElements: SceneElementsMap,
    modifierOptions?: "deleted" | "inserted",
  ) {
    return super.applyLatestChanges(
      delta,
      prevElements,
      nextElements,
      modifierOptions,
    ) as HistoryDelta;
  }
}

export class HistoryChangedEvent {
  constructor(
    public readonly isUndoStackEmpty: boolean = true,
    public readonly isRedoStackEmpty: boolean = true,
  ) {}
}

export class History {
  public readonly onHistoryChangedEmitter = new Emitter<
    [HistoryChangedEvent]
  >();

  public readonly undoStack: HistoryDelta[] = [];
  public readonly redoStack: HistoryDelta[] = [];

  /**
   * When paused, history recording is suspended.
   * Use for isolated editing contexts (e.g., AI manipulation mode)
   * where changes should not be recorded to the main undo stack.
   */
  private _paused = false;

  /**
   * Override state for external undo systems (e.g., AI mode).
   * When set, isUndoStackEmpty/isRedoStackEmpty return these values
   * instead of checking the actual stacks.
   */
  private _overrideUndoEmpty: boolean | null = null;
  private _overrideRedoEmpty: boolean | null = null;

  public get isUndoStackEmpty() {
    if (this._overrideUndoEmpty !== null) {
      return this._overrideUndoEmpty;
    }
    return this.undoStack.length === 0;
  }

  public get isRedoStackEmpty() {
    if (this._overrideRedoEmpty !== null) {
      return this._overrideRedoEmpty;
    }
    return this.redoStack.length === 0;
  }

  public get isPaused() {
    return this._paused;
  }

  /**
   * Pause history recording. While paused, no changes will be
   * added to the undo stack. Useful for isolated editing modes.
   */
  public pause() {
    this._paused = true;
  }

  /**
   * Resume history recording after being paused.
   */
  public resume() {
    this._paused = false;
  }

  /**
   * Callbacks for external undo systems (e.g., AI mode).
   * When set, undo/redo calls these instead of operating on internal stacks.
   */
  private _onUndoOverride: (() => void) | null = null;
  private _onRedoOverride: (() => void) | null = null;

  /**
   * Override the reported stack empty states and undo/redo behavior.
   * Use for external undo systems (e.g., AI mode) to control button UI and actions.
   */
  public overrideState(
    undoEmpty: boolean,
    redoEmpty: boolean,
    onUndo?: () => void,
    onRedo?: () => void,
  ) {
    this._overrideUndoEmpty = undoEmpty;
    this._overrideRedoEmpty = redoEmpty;
    this._onUndoOverride = onUndo ?? null;
    this._onRedoOverride = onRedo ?? null;
    this.onHistoryChangedEmitter.trigger(
      new HistoryChangedEvent(this.isUndoStackEmpty, this.isRedoStackEmpty),
    );
  }

  /**
   * Clear override state, returning to normal stack-based reporting.
   */
  public clearOverride() {
    this._overrideUndoEmpty = null;
    this._overrideRedoEmpty = null;
    this._onUndoOverride = null;
    this._onRedoOverride = null;
    this.onHistoryChangedEmitter.trigger(
      new HistoryChangedEvent(this.isUndoStackEmpty, this.isRedoStackEmpty),
    );
  }

  constructor(private readonly store: Store) {}

  public clear() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  /**
   * Record a non-empty local durable increment, which will go into the undo stack..
   * Do not re-record history entries, which were already pushed to undo / redo stack, as part of history action.
   */
  public record(delta: StoreDelta) {
    if (this._paused || delta.isEmpty() || delta instanceof HistoryDelta) {
      return;
    }

    // construct history entry, so once it's emitted, it's not recorded again
    const historyDelta = HistoryDelta.inverse(delta);

    this.undoStack.push(historyDelta);

    if (!historyDelta.elements.isEmpty()) {
      // don't reset redo stack on local appState changes,
      // as a simple click (unselect) could lead to losing all the redo entries
      // only reset on non empty elements changes!
      this.redoStack.length = 0;
    }

    this.onHistoryChangedEmitter.trigger(
      new HistoryChangedEvent(this.isUndoStackEmpty, this.isRedoStackEmpty),
    );
  }

  public undo(elements: SceneElementsMap, appState: AppState) {
    // If override callback is set, call it instead of normal undo
    if (this._onUndoOverride) {
      this._onUndoOverride();
      return;
    }
    return this.perform(
      elements,
      appState,
      () => History.pop(this.undoStack),
      (entry: HistoryDelta) => History.push(this.redoStack, entry),
    );
  }

  public redo(elements: SceneElementsMap, appState: AppState) {
    // If override callback is set, call it instead of normal redo
    if (this._onRedoOverride) {
      this._onRedoOverride();
      return;
    }
    return this.perform(
      elements,
      appState,
      () => History.pop(this.redoStack),
      (entry: HistoryDelta) => History.push(this.undoStack, entry),
    );
  }

  private perform(
    elements: SceneElementsMap,
    appState: AppState,
    pop: () => HistoryDelta | null,
    push: (entry: HistoryDelta) => void,
  ): [SceneElementsMap, AppState] | void {
    try {
      let historyDelta = pop();

      if (historyDelta === null) {
        return;
      }

      const action = CaptureUpdateAction.IMMEDIATELY;

      let prevSnapshot = this.store.snapshot;

      let nextElements = elements;
      let nextAppState = appState;
      let containsVisibleChange = false;

      // iterate through the history entries in case they result in no visible changes
      while (historyDelta) {
        try {
          [nextElements, nextAppState, containsVisibleChange] =
            historyDelta.applyTo(nextElements, nextAppState, prevSnapshot);

          const prevElements = prevSnapshot.elements;
          const nextSnapshot = prevSnapshot.maybeClone(
            action,
            nextElements,
            nextAppState,
          );

          const change = StoreChange.create(prevSnapshot, nextSnapshot);
          const delta = HistoryDelta.applyLatestChanges(
            historyDelta,
            prevElements,
            nextElements,
          );

          if (!delta.isEmpty()) {
            // schedule immediate capture, so that it's emitted for the sync purposes
            this.store.scheduleMicroAction({
              action,
              change,
              delta,
            });

            historyDelta = delta;
          }

          prevSnapshot = nextSnapshot;
        } finally {
          push(historyDelta);
        }

        if (containsVisibleChange) {
          break;
        }

        historyDelta = pop();
      }

      return [nextElements, nextAppState];
    } finally {
      // trigger the history change event before returning completely
      // also trigger it just once, no need doing so on each entry
      this.onHistoryChangedEmitter.trigger(
        new HistoryChangedEvent(this.isUndoStackEmpty, this.isRedoStackEmpty),
      );
    }
  }

  private static pop(stack: HistoryDelta[]): HistoryDelta | null {
    if (!stack.length) {
      return null;
    }

    const entry = stack.pop();

    if (entry !== undefined) {
      return entry;
    }

    return null;
  }

  private static push(stack: HistoryDelta[], entry: HistoryDelta) {
    const inversedEntry = HistoryDelta.inverse(entry);
    return stack.push(inversedEntry);
  }
}
