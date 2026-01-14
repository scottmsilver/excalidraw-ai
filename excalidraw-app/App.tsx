import {
  Excalidraw,
  LiveCollaborationTrigger,
  TTDDialogTrigger,
  CaptureUpdateAction,
  reconcileElements,
  useEditorInterface,
  exportToBlob,
  MIME_TYPES,
} from "@excalidraw/excalidraw";
import { useTunnels } from "@excalidraw/excalidraw/context/tunnels";
import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import {
  CommandPalette,
  DEFAULT_CATEGORIES,
} from "@excalidraw/excalidraw/components/CommandPalette/CommandPalette";
import { ErrorDialog } from "@excalidraw/excalidraw/components/ErrorDialog";
import { OverwriteConfirmDialog } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirm";
import { openConfirmModal } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirmState";
import { ShareableLinkDialog } from "@excalidraw/excalidraw/components/ShareableLinkDialog";
import Trans from "@excalidraw/excalidraw/components/Trans";
import {
  APP_NAME,
  EVENT,
  THEME,
  VERSION_TIMEOUT,
  debounce,
  getVersion,
  getFrame,
  isTestEnv,
  preventUnload,
  resolvablePromise,
  isRunningInIframe,
  isDevEnv,
  randomId,
} from "@excalidraw/common";
import polyfill from "@excalidraw/excalidraw/polyfill";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { loadFromBlob } from "@excalidraw/excalidraw/data/blob";
import { useCallbackRefState } from "@excalidraw/excalidraw/hooks/useCallbackRefState";
import { t } from "@excalidraw/excalidraw/i18n";

import {
  GithubIcon,
  XBrandIcon,
  DiscordIcon,
  ExcalLogo,
  usersIcon,
  exportToPlus,
  share,
  youtubeIcon,
  MagicIcon,
} from "@excalidraw/excalidraw/components/icons";
import {
  isElementLink,
  newImageElement,
  syncInvalidIndices,
  getCommonBounds,
} from "@excalidraw/element";
import {
  bumpElementVersions,
  restoreAppState,
  restoreElements,
} from "@excalidraw/excalidraw/data/restore";
import { newElementWith } from "@excalidraw/element";
import { isInitializedImageElement } from "@excalidraw/element";
import clsx from "clsx";
import {
  parseLibraryTokensFromUrl,
  useHandleLibrary,
} from "@excalidraw/excalidraw/data/library";

import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";
import type { RestoredDataState } from "@excalidraw/excalidraw/data/restore";
import type {
  ExcalidrawElement,
  FileId,
  NonDeletedExcalidrawElement,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  AppState,
  ExcalidrawImperativeAPI,
  BinaryFiles,
  ExcalidrawInitialDataState,
  UIAppState,
  DataURL,
} from "@excalidraw/excalidraw/types";
import type { ResolutionType } from "@excalidraw/common/utility-types";
import type { ResolvablePromise } from "@excalidraw/common/utils";

import {
  AIManipulationProvider,
  useAIManipulation,
} from "../src/providers/AIManipulationProvider";

import { ReferencePointsOverlay } from "../src/components/ReferencePoints";

import { ManipulationDialog } from "../src/components/ManipulationDialog";
import { extractShapesFromElements } from "../src/utils/shapeExtractor";

import { ThinkingOverlay } from "./components/ThinkingOverlay";

import CustomStats from "./CustomStats";
import {
  Provider,
  useAtom,
  useAtomValue,
  useAtomWithInitialValue,
  appJotaiStore,
} from "./app-jotai";
import {
  FIREBASE_STORAGE_PREFIXES,
  isExcalidrawPlusSignedUser,
  STORAGE_KEYS,
  SYNC_BROWSER_TABS_TIMEOUT,
} from "./app_constants";
import Collab, {
  collabAPIAtom,
  isCollaboratingAtom,
  isOfflineAtom,
} from "./collab/Collab";
import { AppFooter } from "./components/AppFooter";
import { AppMainMenu } from "./components/AppMainMenu";
import { AppWelcomeScreen } from "./components/AppWelcomeScreen";
import {
  ExportToExcalidrawPlus,
  exportToExcalidrawPlus,
} from "./components/ExportToExcalidrawPlus";
import { TopErrorBoundary } from "./components/TopErrorBoundary";

import {
  exportToBackend,
  getCollaborationLinkData,
  importFromBackend,
  isCollaborationLink,
} from "./data";

import { updateStaleImageStatuses } from "./data/FileManager";
import {
  importFromLocalStorage,
  importUsernameFromLocalStorage,
} from "./data/localStorage";

import { loadFilesFromFirebase } from "./data/firebase";
import {
  LibraryIndexedDBAdapter,
  LibraryLocalStorageMigrationAdapter,
  LocalData,
  localStorageQuotaExceededAtom,
} from "./data/LocalData";
import { isBrowserStorageStateNewer } from "./data/tabSync";
import { ShareDialog, shareDialogStateAtom } from "./share/ShareDialog";
import CollabError, { collabErrorIndicatorAtom } from "./collab/CollabError";
import { useHandleAppTheme } from "./useHandleAppTheme";
import { getPreferredLanguage } from "./app-language/language-detector";
import { useAppLangCode } from "./app-language/language-state";
import DebugCanvas, {
  debugRenderer,
  isVisualDebuggerEnabled,
  loadSavedDebugState,
} from "./components/DebugCanvas";
import { AIComponents } from "./components/AI";
import { ExcalidrawPlusIframeExport } from "./ExcalidrawPlusIframeExport";
import {
  CoordinateHighlightProvider,
  useCoordinateHighlight,
} from "./ai/CoordinateHighlightContext";
import { CoordinateHighlightOverlay } from "./ai/CoordinateHighlightOverlay";

import "./index.scss";

import { ExcalidrawPlusPromoBanner } from "./components/ExcalidrawPlusPromoBanner";
import { AppSidebar } from "./components/AppSidebar";

import type { CollabAPI } from "./collab/Collab";

polyfill();

window.EXCALIDRAW_THROTTLE_RENDER = true;

declare global {
  interface BeforeInstallPromptEventChoiceResult {
    outcome: "accepted" | "dismissed";
  }

  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<BeforeInstallPromptEventChoiceResult>;
  }

  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

let pwaEvent: BeforeInstallPromptEvent | null = null;

// Adding a listener outside of the component as it may (?) need to be
// subscribed early to catch the event.
//
// Also note that it will fire only if certain heuristics are met (user has
// used the app for some time, etc.)
window.addEventListener(
  "beforeinstallprompt",
  (event: BeforeInstallPromptEvent) => {
    // prevent Chrome <= 67 from automatically showing the prompt
    event.preventDefault();
    // cache for later use
    pwaEvent = event;
  },
);

let isSelfEmbedding = false;

if (window.self !== window.top) {
  try {
    const parentUrl = new URL(document.referrer);
    const currentUrl = new URL(window.location.href);
    if (parentUrl.origin === currentUrl.origin) {
      isSelfEmbedding = true;
    }
  } catch (error) {
    // ignore
  }
}

const shareableLinkConfirmDialog = {
  title: t("overwriteConfirm.modal.shareableLink.title"),
  description: (
    <Trans
      i18nKey="overwriteConfirm.modal.shareableLink.description"
      bold={(text) => <strong>{text}</strong>}
      br={() => <br />}
    />
  ),
  actionLabel: t("overwriteConfirm.modal.shareableLink.button"),
  color: "danger",
} as const;

const initializeScene = async (opts: {
  collabAPI: CollabAPI | null;
  excalidrawAPI: ExcalidrawImperativeAPI;
}): Promise<
  { scene: ExcalidrawInitialDataState | null } & (
    | { isExternalScene: true; id: string; key: string }
    | { isExternalScene: false; id?: null; key?: null }
  )
> => {
  const searchParams = new URLSearchParams(window.location.search);
  const id = searchParams.get("id");
  const jsonBackendMatch = window.location.hash.match(
    /^#json=([a-zA-Z0-9_-]+),([a-zA-Z0-9_-]+)$/,
  );
  const externalUrlMatch = window.location.hash.match(/^#url=(.*)$/);

  const localDataState = importFromLocalStorage();

  let scene: Omit<
    RestoredDataState,
    // we're not storing files in the scene database/localStorage, and instead
    // fetch them async from a different store
    "files"
  > & {
    scrollToContent?: boolean;
  } = {
    elements: restoreElements(localDataState?.elements, null, {
      repairBindings: true,
      deleteInvisibleElements: true,
    }),
    appState: restoreAppState(localDataState?.appState, null),
  };

  let roomLinkData = getCollaborationLinkData(window.location.href);
  const isExternalScene = !!(id || jsonBackendMatch || roomLinkData);
  if (isExternalScene) {
    if (
      // don't prompt if scene is empty
      !scene.elements.length ||
      // don't prompt for collab scenes because we don't override local storage
      roomLinkData ||
      // otherwise, prompt whether user wants to override current scene
      (await openConfirmModal(shareableLinkConfirmDialog))
    ) {
      if (jsonBackendMatch) {
        const imported = await importFromBackend(
          jsonBackendMatch[1],
          jsonBackendMatch[2],
        );

        scene = {
          elements: bumpElementVersions(
            restoreElements(imported.elements, null, {
              repairBindings: true,
              deleteInvisibleElements: true,
            }),
            localDataState?.elements,
          ),
          appState: restoreAppState(
            imported.appState,
            // local appState when importing from backend to ensure we restore
            // localStorage user settings which we do not persist on server.
            localDataState?.appState,
          ),
        };
      }
      scene.scrollToContent = true;
      if (!roomLinkData) {
        window.history.replaceState({}, APP_NAME, window.location.origin);
      }
    } else {
      // https://github.com/excalidraw/excalidraw/issues/1919
      if (document.hidden) {
        return new Promise((resolve, reject) => {
          window.addEventListener(
            "focus",
            () => initializeScene(opts).then(resolve).catch(reject),
            {
              once: true,
            },
          );
        });
      }

      roomLinkData = null;
      window.history.replaceState({}, APP_NAME, window.location.origin);
    }
  } else if (externalUrlMatch) {
    window.history.replaceState({}, APP_NAME, window.location.origin);

    const url = externalUrlMatch[1];
    try {
      const request = await fetch(window.decodeURIComponent(url));
      const data = await loadFromBlob(await request.blob(), null, null);
      if (
        !scene.elements.length ||
        (await openConfirmModal(shareableLinkConfirmDialog))
      ) {
        return { scene: data, isExternalScene };
      }
    } catch (error: any) {
      return {
        scene: {
          appState: {
            errorMessage: t("alerts.invalidSceneUrl"),
          },
        },
        isExternalScene,
      };
    }
  }

  if (roomLinkData && opts.collabAPI) {
    const { excalidrawAPI } = opts;

    const scene = await opts.collabAPI.startCollaboration(roomLinkData);

    return {
      // when collaborating, the state may have already been updated at this
      // point (we may have received updates from other clients), so reconcile
      // elements and appState with existing state
      scene: {
        ...scene,
        appState: {
          ...restoreAppState(
            {
              ...scene?.appState,
              theme: localDataState?.appState?.theme || scene?.appState?.theme,
            },
            excalidrawAPI.getAppState(),
          ),
          // necessary if we're invoking from a hashchange handler which doesn't
          // go through App.initializeScene() that resets this flag
          isLoading: false,
        },
        elements: reconcileElements(
          scene?.elements || [],
          excalidrawAPI.getSceneElementsIncludingDeleted() as RemoteExcalidrawElement[],
          excalidrawAPI.getAppState(),
        ),
      },
      isExternalScene: true,
      id: roomLinkData.roomId,
      key: roomLinkData.roomKey,
    };
  } else if (scene) {
    return isExternalScene && jsonBackendMatch
      ? {
          scene,
          isExternalScene,
          id: jsonBackendMatch[1],
          key: jsonBackendMatch[2],
        }
      : { scene, isExternalScene: false };
  }
  return { scene: null, isExternalScene: false };
};

// =============================================================================
// AI Manipulation UI Components
// =============================================================================

/**
 * Convert data URL to Blob
 */
function dataURLToBlob(dataURL: string): Blob | null {
  if (!dataURL) {
    return null;
  }
  try {
    const arr = dataURL.split(",");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) {
      return null;
    }
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch {
    return null;
  }
}

/**
 * Container component for AI manipulation features.
 * Must be used within AIManipulationProvider.
 *
 * Handles Shift+Click for placing markers when AI mode is active.
 */
const AIManipulationUI: React.FC<{
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}> = ({ excalidrawAPI }) => {
  const {
    referencePoints,
    removeReferencePoint,
    clearReferencePoints,
    isDialogOpen,
    closeDialog,
    cleanCanvasImage,
    annotatedCanvasImage,
    exitAIMode,
    isAIModeActive,
    isProcessing,
    isReviewing,
    progress,
    iterationImages,
    addPoint,
    exportBounds,
    addIterationImage,
    enterReviewMode,
    acceptResult,
    rejectResult,
    elementsSnapshot,
    setElementsSnapshot,
    initializeAIUndoState,
    pushAIUndoEntry,
    clearAIUndoStack,
    aiUndo,
    aiRedo,
    canAIUndo,
    canAIRedo,
  } = useAIManipulation();

  // Clear AI undo stack when exiting AI mode
  // Note: Snapshot and initialization are done in handleToggle (AIToolbarButton) BEFORE locking
  React.useEffect(() => {
    if (!isAIModeActive) {
      clearAIUndoStack();
    }
  }, [isAIModeActive, clearAIUndoStack]);

  // Track element changes during AI mode for undo/redo
  // Use a ref to avoid re-subscribing on every pushAIUndoEntry change
  const pushAIUndoEntryRef = React.useRef(pushAIUndoEntry);
  pushAIUndoEntryRef.current = pushAIUndoEntry;

  React.useEffect(() => {
    if (!isAIModeActive || !excalidrawAPI) {
      return;
    }

    // Subscribe to changes
    const unsubscribe = excalidrawAPI.onChange((elements) => {
      // Filter non-deleted elements and push to undo stack
      const nonDeletedElements = elements.filter((el) => !el.isDeleted);
      pushAIUndoEntryRef.current(nonDeletedElements);
    });

    return () => {
      unsubscribe();
    };
  }, [isAIModeActive, excalidrawAPI]);

  // Keyboard shortcuts for AI mode undo/redo
  // Intercepts Ctrl+Z and Ctrl+Shift+Z/Ctrl+Y when AI mode is active
  React.useEffect(() => {
    if (!isAIModeActive || !excalidrawAPI) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const isZ = e.key === "z" || e.key === "Z";
      const isY = e.key === "y" || e.key === "Y";

      // Ctrl+Shift+Z or Ctrl+Y = Redo
      if (isCtrlOrCmd && ((isZ && e.shiftKey) || isY)) {
        e.preventDefault();
        e.stopPropagation();
        const elementsToRestore = aiRedo();
        if (elementsToRestore && excalidrawAPI) {
          excalidrawAPI.updateScene({
            elements: elementsToRestore as any,
            captureUpdate: CaptureUpdateAction.NEVER,
          });
        }
        return;
      }

      // Ctrl+Z = Undo
      if (isCtrlOrCmd && isZ && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        const elementsToRestore = aiUndo();
        if (elementsToRestore && excalidrawAPI) {
          excalidrawAPI.updateScene({
            elements: elementsToRestore as any,
            captureUpdate: CaptureUpdateAction.NEVER,
          });
        }
        return;
      }
    };

    // Use capture phase to intercept before excalidraw handles it
    document.addEventListener("keydown", handleKeyDown, { capture: true });

    return () => {
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [isAIModeActive, excalidrawAPI, aiUndo, aiRedo]);

  // AI undo/redo handlers for button clicks
  const handleAIUndo = useCallback(() => {
    const elementsToRestore = aiUndo();
    if (elementsToRestore && excalidrawAPI) {
      excalidrawAPI.updateScene({
        elements: elementsToRestore as ExcalidrawElement[],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    }
  }, [aiUndo, excalidrawAPI]);

  const handleAIRedo = useCallback(() => {
    const elementsToRestore = aiRedo();
    if (elementsToRestore && excalidrawAPI) {
      excalidrawAPI.updateScene({
        elements: elementsToRestore as ExcalidrawElement[],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    }
  }, [aiRedo, excalidrawAPI]);

  // Sync AI undo state to excalidraw's history UI
  // This makes the native undo/redo buttons reflect AI mode state and behavior
  React.useEffect(() => {
    if (!excalidrawAPI) return;

    if (isAIModeActive) {
      // Override history button states and behavior with AI undo stack
      excalidrawAPI.history.overrideState(
        !canAIUndo,
        !canAIRedo,
        handleAIUndo,
        handleAIRedo,
      );
    } else {
      // Clear overrides when exiting AI mode
      excalidrawAPI.history.clearOverride();
    }
  }, [isAIModeActive, excalidrawAPI, canAIUndo, canAIRedo, handleAIUndo, handleAIRedo]);

  // Get app state for overlay positioning
  const appState = excalidrawAPI?.getAppState();
  const zoom = appState?.zoom?.value ?? 1;
  const scrollX = appState?.scrollX ?? 0;
  const scrollY = appState?.scrollY ?? 0;

  // Collect iteration images as they come in from SSE progress
  const lastIterationImageRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (
      progress?.iterationImage &&
      progress.iterationImage !== lastIterationImageRef.current
    ) {
      lastIterationImageRef.current = progress.iterationImage;
      addIterationImage(progress.iterationImage);
    }
  }, [progress?.iterationImage, addIterationImage]);

  // Enter review mode when processing completes and we have iteration images
  const wasProcessingRef = React.useRef(false);
  React.useEffect(() => {
    if (
      wasProcessingRef.current &&
      !isProcessing &&
      iterationImages.length > 0 &&
      !isReviewing
    ) {
      enterReviewMode();
    }
    wasProcessingRef.current = isProcessing;
  }, [isProcessing, iterationImages.length, isReviewing, enterReviewMode]);

  // Determine ThinkingOverlay status
  const overlayStatus = React.useMemo(() => {
    if (isReviewing) {
      return "reviewing" as const;
    }
    if (isProcessing) {
      return "thinking" as const;
    }
    return "idle" as const;
  }, [isProcessing, isReviewing]);

  // Convert canvas images (data URLs) to Blobs for ManipulationDialog
  const cleanImageBlob = React.useMemo(
    () => dataURLToBlob(cleanCanvasImage),
    [cleanCanvasImage],
  );

  const annotatedImageBlob = React.useMemo(
    () => dataURLToBlob(annotatedCanvasImage),
    [annotatedCanvasImage],
  );

  // Extract shapes for AI context when dialog is open
  const shapes = React.useMemo(() => {
    if (!isDialogOpen || !excalidrawAPI || !exportBounds) {
      return [];
    }
    const elements = excalidrawAPI.getSceneElements();
    return extractShapesFromElements(elements, exportBounds);
  }, [isDialogOpen, excalidrawAPI, exportBounds]);

  // Handle result from AI manipulation
  const handleResult = useCallback(
    async (imageData: string) => {
      if (!excalidrawAPI) {
        console.error("No excalidraw API available");
        clearReferencePoints();
        exitAIMode();
        closeDialog();
        return;
      }

      try {
        // Resume history recording so the final change is recorded
        excalidrawAPI.history.resume();

        // Ensure imageData is a data URL
        const dataURL = (
          imageData.startsWith("data:")
            ? imageData
            : `data:image/png;base64,${imageData}`
        ) as DataURL;

        // Generate unique file ID (cast to FileId branded type)
        const fileId = `ai-result-${Date.now()}-${randomId()}` as FileId;

        // Add image file to excalidraw
        excalidrawAPI.addFiles([
          {
            id: fileId,
            dataURL,
            mimeType: "image/png",
            created: Date.now(),
          },
        ]);

        // Get snapshot elements for filtering annotations
        const snapshotElements =
          elementsSnapshot as readonly ExcalidrawElement[];

        // Build set of original element IDs from snapshot
        const originalElementIds = new Set(snapshotElements.map((el) => el.id));

        // Use exportBounds for positioning - this matches exactly where the preview was shown
        // exportBounds is computed at execute time from the actual exported image
        let minX: number;
        let minY: number;
        let width: number;
        let height: number;

        if (exportBounds && exportBounds.imageWidth && exportBounds.imageHeight) {
          // Use the same bounds that were used for the export/preview
          minX = exportBounds.minX - exportBounds.exportPadding;
          minY = exportBounds.minY - exportBounds.exportPadding;
          width = exportBounds.imageWidth;
          height = exportBounds.imageHeight;
        } else {
          // Fallback to default position (shouldn't happen in normal flow)
          minX = 0;
          minY = 0;
          width = 400;
          height = 300;
        }

        // Create image element at the same position/size as the export
        const imageElement = newImageElement({
          type: "image",
          x: minX,
          y: minY,
          width: width > 0 ? width : 400,
          height: height > 0 ? height : 300,
          fileId,
          status: "saved",
        });

        // Get current elements and filter/transform them:
        // 1. Keep only elements that existed before AI mode (filter out annotations)
        // 2. Unlock those elements
        // 3. Mark annotations as deleted (preserves history better than removing)
        const currentElements = excalidrawAPI.getSceneElements();
        const cleanedElements = currentElements.map((el) => {
          if (originalElementIds.has(el.id)) {
            // Original element - unlock it
            return newElementWith(el, { locked: false });
          } else {
            // Annotation - mark as deleted
            return newElementWith(el, { isDeleted: true });
          }
        });

        // Add AI image and sync indices
        const finalElements = syncInvalidIndices([
          ...cleanedElements,
          imageElement,
        ]);

        // Single update: clean up annotations + unlock originals + add AI image
        // This is recorded as a single undo entry
        excalidrawAPI.updateScene({
          elements: finalElements,
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });

        clearReferencePoints();
        exitAIMode();

        // Small delay before closing overlay to let the image render
        // This prevents a flash while the canvas image loads
        setTimeout(() => {
          closeDialog();
        }, 150);
      } catch (error) {
        console.error("Failed to add AI result to canvas:", error);
        clearReferencePoints();
        exitAIMode();
        closeDialog();
      }
    },
    [
      excalidrawAPI,
      elementsSnapshot,
      exportBounds,
      clearReferencePoints,
      exitAIMode,
      closeDialog,
    ],
  );

  // Handle accept - apply the selected iteration image
  const handleAccept = React.useCallback(
    (selectedIndex: number) => {
      const selectedImage = iterationImages[selectedIndex];
      if (selectedImage) {
        handleResult(selectedImage);
      }
      acceptResult(selectedIndex);
    },
    [iterationImages, handleResult, acceptResult],
  );

  // Handle reject - remove annotations and cleanup
  const handleReject = React.useCallback(() => {
    // Resume history recording
    excalidrawAPI?.history.resume();

    // Get original element IDs from snapshot
    const snapshotElements = elementsSnapshot as readonly ExcalidrawElement[];
    const originalElementIds = new Set(snapshotElements.map((el) => el.id));

    if (excalidrawAPI) {
      // Get current elements and clean them up:
      // - Delete annotations (elements not in original snapshot)
      // - Unlock original elements
      const currentElements = excalidrawAPI.getSceneElements();
      const cleanedElements = currentElements.map((el) => {
        if (originalElementIds.has(el.id)) {
          // Original element - unlock it
          return newElementWith(el, { locked: false });
        } else {
          // Annotation - mark as deleted
          return newElementWith(el, { isDeleted: true });
        }
      });

      const syncedElements = syncInvalidIndices(cleanedElements);
      // Use NEVER to avoid recording the cleanup in undo stack
      excalidrawAPI.updateScene({
        elements: syncedElements,
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    }
    rejectResult();
    clearReferencePoints();
    exitAIMode();
    closeDialog();
  }, [
    excalidrawAPI,
    elementsSnapshot,
    rejectResult,
    clearReferencePoints,
    exitAIMode,
    closeDialog,
  ]);

  // Shift+Click handler for placing markers + crosshair cursor
  useEffect(() => {
    if (!isAIModeActive) {
      return;
    }

    // Inject CSS for custom crosshair cursor (thinner than default)
    // SVG crosshair: 32x32 with center at 16,16
    const styleId = "ai-mode-crosshair-style";
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      // Create a thin crosshair cursor using SVG data URL
      const crosshairSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><line x1="16" y1="0" x2="16" y2="32" stroke="black" stroke-width="1"/><line x1="0" y1="16" x2="32" y2="16" stroke="black" stroke-width="1"/><circle cx="16" cy="16" r="2" fill="none" stroke="black" stroke-width="1"/></svg>`;
      const cursorUrl = `url('data:image/svg+xml,${encodeURIComponent(
        crosshairSvg,
      )}') 16 16, crosshair`;
      styleEl.textContent = `
        .excalidraw.ai-crosshair-mode,
        .excalidraw.ai-crosshair-mode * {
          cursor: ${cursorUrl} !important;
        }
      `;
      document.head.appendChild(styleEl);
    }

    const canvasContainer = document.querySelector(
      ".excalidraw",
    ) as HTMLElement | null;

    // Set crosshair cursor when Shift is pressed
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift" && canvasContainer) {
        canvasContainer.classList.add("ai-crosshair-mode");
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift" && canvasContainer) {
        canvasContainer.classList.remove("ai-crosshair-mode");
      }
    };

    // Also handle blur (window loses focus while Shift is held)
    const handleBlur = () => {
      if (canvasContainer) {
        canvasContainer.classList.remove("ai-crosshair-mode");
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (!e.shiftKey) {
        return;
      }

      if (!canvasContainer) {
        return;
      }

      const currentAppState = excalidrawAPI?.getAppState();
      if (!currentAppState) {
        return;
      }

      // Convert screen coordinates to canvas coordinates
      // Using the correct formula: canvasX = screenX / zoom - scrollX
      const rect = canvasContainer.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const canvasX =
        screenX / currentAppState.zoom.value - currentAppState.scrollX;
      const canvasY =
        screenY / currentAppState.zoom.value - currentAppState.scrollY;

      addPoint(canvasX, canvasY);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    document.addEventListener("click", handleClick);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
      document.removeEventListener("click", handleClick);
      window.removeEventListener("blur", handleBlur);
      // Remove crosshair class on cleanup
      if (canvasContainer) {
        canvasContainer.classList.remove("ai-crosshair-mode");
      }
    };
  }, [isAIModeActive, excalidrawAPI, addPoint]);

  return (
    <>
      {/* Reference Points Overlay */}
      <ReferencePointsOverlay
        points={referencePoints}
        scale={zoom}
        scrollX={scrollX}
        scrollY={scrollY}
        onPointRemove={(point) => removeReferencePoint(point.id)}
      />

      {/* Manipulation Dialog */}
      <ManipulationDialog
        isOpen={isDialogOpen}
        onClose={closeDialog}
        referencePoints={referencePoints}
        shapes={shapes}
        cleanImageBlob={cleanImageBlob}
        annotatedImageBlob={annotatedImageBlob}
        onResult={handleResult}
        exportBounds={exportBounds ?? undefined}
      />

      {/* Thinking Overlay - sparks effect, interim proposals, and accept/reject UI */}
      <ThinkingOverlay
        status={overlayStatus}
        showBorder={false}
        image={progress?.iterationImage}
        iterationImages={iterationImages}
        originalImage={cleanCanvasImage}
        imageWidth={exportBounds?.imageWidth}
        imageHeight={exportBounds?.imageHeight}
        canvasBounds={exportBounds}
        viewport={zoom !== undefined ? { scrollX, scrollY, zoom } : null}
        onAccept={handleAccept}
        onReject={handleReject}
      />

      {/* AI Mode Hint - shows in same style as HintViewer */}
      {isAIModeActive && (
        <div
          style={{
            position: "fixed",
            bottom: "80px",
            left: "50%",
            transform: "translateX(-50%)",
            pointerEvents: "none",
            color: "var(--color-gray-40)",
            fontSize: "0.75rem",
            textAlign: "center",
            zIndex: 100,
          }}
        >
          <kbd
            style={{
              display: "inline-block",
              margin: "0 2px",
              fontFamily: "monospace",
              border: "1px solid var(--color-gray-40)",
              borderRadius: "4px",
              padding: "1px 4px",
              fontSize: "10px",
            }}
          >
            Shift
          </kbd>
          +Click to place markers
          {referencePoints.length > 0 && ` (${referencePoints.length} placed)`}
        </div>
      )}

    </>
  );
};

/**
 * Get non-deleted elements from the scene for snapshotting.
 */
const getSnapshotElements = (excalidrawAPI: ExcalidrawImperativeAPI) => {
  const currentElements = excalidrawAPI.getSceneElements();
  return currentElements.filter((el) => !el.isDeleted);
};

/**
 * Lock all elements in the scene so they can't be modified.
 * Used when entering AI mode to prevent changes to original content.
 */
const lockAllElements = (excalidrawAPI: ExcalidrawImperativeAPI) => {
  const currentElements = excalidrawAPI.getSceneElements();
  const lockedElements = currentElements.map((el) =>
    newElementWith(el, { locked: true })
  );
  const syncedElements = syncInvalidIndices(lockedElements);
  excalidrawAPI.updateScene({
    elements: syncedElements,
    captureUpdate: CaptureUpdateAction.NEVER,
  });
};

const AIToolbarButton: React.FC<{
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}> = ({ excalidrawAPI }) => {
  const {
    openDialog,
    isProcessing,
    isAIModeActive,
    enterAIMode,
    exitAIMode,
    referencePoints,
    clearReferencePoints,
    setCleanCanvasImage,
    setAnnotatedCanvasImage,
    setExportBounds,
    elementsSnapshot,
    setElementsSnapshot,
    initializeAIUndoState,
  } = useAIManipulation();

  // Sync export bounds to coordinate highlight context for AI log coordinate display
  const { setExportBounds: setCoordHighlightBounds } = useCoordinateHighlight();

  // Default export padding (matches excalidraw's DEFAULT_EXPORT_PADDING)
  const EXPORT_PADDING = 10;

  // Capture canvas images (clean + annotated) and open dialog
  const handleExecute = useCallback(async () => {
    if (!excalidrawAPI) {
      return;
    }

    try {
      const allElements = excalidrawAPI.getSceneElements();
      const files = excalidrawAPI.getFiles();
      const currentAppState = excalidrawAPI.getAppState();

      // Get the snapshot elements (original before annotations)
      const cleanElements = elementsSnapshot as readonly ExcalidrawElement[];

      // Calculate the bounds of all elements for coordinate transformation
      // This matches how exportToBlob crops the image
      const [minX, minY, maxX, maxY] = getCommonBounds(allElements);

      // Calculate image dimensions (includes padding on all sides)
      const imageWidth = maxX - minX + 2 * EXPORT_PADDING;
      const imageHeight = maxY - minY + 2 * EXPORT_PADDING;

      // Create export bounds for coordinate transformation
      const exportBoundsData = {
        minX,
        minY,
        exportPadding: EXPORT_PADDING,
        imageWidth,
        imageHeight,
      };

      // Set export bounds in both contexts:
      // 1. AIManipulation context - for ManipulationDialog coordinate transformation
      setExportBounds(exportBoundsData);
      // 2. CoordinateHighlight context - for AI log hover coordinate display
      setCoordHighlightBounds(exportBoundsData);

      // Export ANNOTATED image (all elements including user's drawings)
      const annotatedBlob = await exportToBlob({
        elements: allElements,
        appState: {
          ...currentAppState,
          exportBackground: true,
          viewBackgroundColor: currentAppState.viewBackgroundColor,
        },
        files,
        mimeType: MIME_TYPES.png,
      });

      // Export CLEAN image (original elements only, no annotations)
      // Use snapshot elements if available, otherwise fall back to all elements
      const cleanElementsToExport =
        cleanElements.length > 0 ? cleanElements : allElements;
      const cleanBlob = await exportToBlob({
        elements: cleanElementsToExport,
        appState: {
          ...currentAppState,
          exportBackground: true,
          viewBackgroundColor: currentAppState.viewBackgroundColor,
        },
        files,
        mimeType: MIME_TYPES.png,
      });

      // Convert blobs to data URLs
      const blobToDataURL = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      };

      const [cleanImageData, annotatedImageData] = await Promise.all([
        blobToDataURL(cleanBlob),
        blobToDataURL(annotatedBlob),
      ]);

      // Set both images in context
      setCleanCanvasImage(cleanImageData);
      setAnnotatedCanvasImage(annotatedImageData);
      openDialog();
    } catch (error) {
      console.error("Failed to capture canvas:", error);
      setExportBounds(null);
      setCoordHighlightBounds(null);
      openDialog();
    }
  }, [
    excalidrawAPI,
    elementsSnapshot,
    openDialog,
    setCleanCanvasImage,
    setAnnotatedCanvasImage,
    setExportBounds,
    setCoordHighlightBounds,
  ]);

  // Toggle AI mode
  const handleToggle = useCallback(() => {
    if (isAIModeActive) {
      // Exiting AI mode via toggle (not accept/reject)
      // Resume history recording
      excalidrawAPI?.history.resume();

      // Get original element IDs from snapshot
      const snapshotElements = elementsSnapshot as readonly ExcalidrawElement[];
      const originalElementIds = new Set(snapshotElements.map((el) => el.id));

      if (excalidrawAPI) {
        // Clean up: delete annotations, unlock original elements
        const currentElements = excalidrawAPI.getSceneElements();
        const cleanedElements = currentElements.map((el) => {
          if (originalElementIds.has(el.id)) {
            return newElementWith(el, { locked: false });
          } else {
            return newElementWith(el, { isDeleted: true });
          }
        });

        const syncedElements = syncInvalidIndices(cleanedElements);
        excalidrawAPI.updateScene({
          elements: syncedElements,
          captureUpdate: CaptureUpdateAction.NEVER,
        });
      }

      clearReferencePoints();
      exitAIMode();
    } else {
      // Entering AI mode - pause history recording
      // All changes during AI mode go to an isolated context
      excalidrawAPI?.history.pause();

      // Take snapshot BEFORE locking so we preserve original unlocked state
      if (excalidrawAPI) {
        const snapshotElements = getSnapshotElements(excalidrawAPI);
        setElementsSnapshot(snapshotElements);
        initializeAIUndoState(snapshotElements);
        lockAllElements(excalidrawAPI);
      }

      enterAIMode();
    }
  }, [isAIModeActive, excalidrawAPI, elementsSnapshot, clearReferencePoints, exitAIMode, enterAIMode, setElementsSnapshot, initializeAIUndoState]);

  // Allow execution when AI mode is active - user can provide context via:
  // - Reference points (Shift+Click markers)
  // - Drawn annotations (arrows, circles, text, etc.)
  // - Just a text command (e.g., "make this brighter")
  const canExecute = isAIModeActive;

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      {/* Main AI button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={isProcessing}
        title={isAIModeActive ? "Exit AI Edit mode" : "AI Edit"}
        className="ToolIcon_type_button"
        aria-label="AI Edit"
        style={{
          color: isAIModeActive ? "var(--color-primary)" : undefined,
          backgroundColor: isAIModeActive
            ? "var(--color-primary-light)"
            : undefined,
        }}
      >
        <div className="ToolIcon__icon" aria-hidden="true">
          {MagicIcon}
        </div>
      </button>

      {/* Popover when AI mode is active */}
      {isAIModeActive && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginTop: "8px",
            backgroundColor: "rgba(255, 255, 255, 0.85)",
            backdropFilter: "blur(8px)",
            borderRadius: "8px",
            boxShadow: "0 2px 12px rgba(0, 0, 0, 0.15)",
            padding: "8px",
            zIndex: 100,
            whiteSpace: "nowrap",
          }}
        >
          {/* Arrow */}
          <div
            style={{
              position: "absolute",
              top: "-6px",
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderBottom: "6px solid rgba(255, 255, 255, 0.85)",
            }}
          />
          {/* Help hint in handwriting style */}
          <div
            style={{
              padding: "8px 4px",
              fontFamily: "Virgil, Segoe UI Emoji, sans-serif",
              fontSize: "12px",
              color: "var(--color-gray-60)",
              lineHeight: 1.4,
              maxWidth: "180px",
              textAlign: "left",
            }}
          >
            <div style={{ marginBottom: "4px" }}>
              <kbd style={{
                fontFamily: "inherit",
                backgroundColor: "var(--color-gray-20)",
                padding: "1px 4px",
                borderRadius: "3px",
                fontSize: "11px",
              }}>Shift</kbd>+Click to place markers
            </div>
            <div style={{ marginBottom: "8px" }}>
              Draw shapes to annotate
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={handleExecute}
                disabled={!canExecute || isProcessing}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "4px 8px",
                  backgroundColor: canExecute
                    ? "var(--color-primary)"
                    : "var(--color-gray-30)",
                  color: canExecute ? "white" : "var(--color-gray-60)",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontFamily: "Assistant, system-ui, sans-serif",
                  fontWeight: 600,
                  cursor: canExecute ? "pointer" : "not-allowed",
                }}
              >
                {isProcessing ? (
                  <>
                    <span
                      style={{
                        width: "10px",
                        height: "10px",
                        border: "2px solid currentColor",
                        borderTopColor: "transparent",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                      }}
                    />
                    Processing...
                  </>
                ) : (
                  <>
                    {MagicIcon}
                    Execute
                    {referencePoints.length > 0 && ` (${referencePoints.length})`}
                  </>
                )}
              </button>
            </div>
          </div>
          <style>
            {`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}
          </style>
        </div>
      )}
    </div>
  );
};

/**
 * Wrapper component that injects AIToolbarButton into the main toolbar via tunnel.
 * This component should be rendered as a child of Excalidraw.
 */
const AIToolbarTunnelContent: React.FC<{
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}> = ({ excalidrawAPI }) => {
  const { AIToolbarTunnel } = useTunnels();

  return (
    <AIToolbarTunnel.In>
      <AIToolbarButton excalidrawAPI={excalidrawAPI} />
    </AIToolbarTunnel.In>
  );
};

const ExcalidrawWrapper = () => {
  const [errorMessage, setErrorMessage] = useState("");
  const isCollabDisabled = isRunningInIframe();

  const { editorTheme, appTheme, setAppTheme } = useHandleAppTheme();

  const [langCode, setLangCode] = useAppLangCode();

  const editorInterface = useEditorInterface();

  // initial state
  // ---------------------------------------------------------------------------

  const initialStatePromiseRef = useRef<{
    promise: ResolvablePromise<ExcalidrawInitialDataState | null>;
  }>({ promise: null! });
  if (!initialStatePromiseRef.current.promise) {
    initialStatePromiseRef.current.promise =
      resolvablePromise<ExcalidrawInitialDataState | null>();
  }

  const debugCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    trackEvent("load", "frame", getFrame());
    // Delayed so that the app has a time to load the latest SW
    setTimeout(() => {
      trackEvent("load", "version", getVersion());
    }, VERSION_TIMEOUT);
  }, []);

  const [excalidrawAPI, excalidrawRefCallback] =
    useCallbackRefState<ExcalidrawImperativeAPI>();

  const [, setShareDialogState] = useAtom(shareDialogStateAtom);
  const [collabAPI] = useAtom(collabAPIAtom);
  const [isCollaborating] = useAtomWithInitialValue(isCollaboratingAtom, () => {
    return isCollaborationLink(window.location.href);
  });
  const collabError = useAtomValue(collabErrorIndicatorAtom);

  useHandleLibrary({
    excalidrawAPI,
    adapter: LibraryIndexedDBAdapter,
    // TODO maybe remove this in several months (shipped: 24-03-11)
    migrationAdapter: LibraryLocalStorageMigrationAdapter,
  });

  const [, forceRefresh] = useState(false);

  useEffect(() => {
    if (isDevEnv()) {
      const debugState = loadSavedDebugState();

      if (debugState.enabled && !window.visualDebug) {
        window.visualDebug = {
          data: [],
        };
      } else {
        delete window.visualDebug;
      }
      forceRefresh((prev) => !prev);

      // Expose excalidrawAPI for debugging
      if (excalidrawAPI) {
        (window as any).excalidrawAPI = excalidrawAPI;
      }
    }
  }, [excalidrawAPI]);

  useEffect(() => {
    if (!excalidrawAPI || (!isCollabDisabled && !collabAPI)) {
      return;
    }

    const loadImages = (
      data: ResolutionType<typeof initializeScene>,
      isInitialLoad = false,
    ) => {
      if (!data.scene) {
        return;
      }
      if (collabAPI?.isCollaborating()) {
        if (data.scene.elements) {
          collabAPI
            .fetchImageFilesFromFirebase({
              elements: data.scene.elements,
              forceFetchFiles: true,
            })
            .then(({ loadedFiles, erroredFiles }) => {
              excalidrawAPI.addFiles(loadedFiles);
              updateStaleImageStatuses({
                excalidrawAPI,
                erroredFiles,
                elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
              });
            });
        }
      } else {
        const fileIds =
          data.scene.elements?.reduce((acc, element) => {
            if (isInitializedImageElement(element)) {
              return acc.concat(element.fileId);
            }
            return acc;
          }, [] as FileId[]) || [];

        if (data.isExternalScene) {
          loadFilesFromFirebase(
            `${FIREBASE_STORAGE_PREFIXES.shareLinkFiles}/${data.id}`,
            data.key,
            fileIds,
          ).then(({ loadedFiles, erroredFiles }) => {
            excalidrawAPI.addFiles(loadedFiles);
            updateStaleImageStatuses({
              excalidrawAPI,
              erroredFiles,
              elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
            });
          });
        } else if (isInitialLoad) {
          if (fileIds.length) {
            LocalData.fileStorage
              .getFiles(fileIds)
              .then(({ loadedFiles, erroredFiles }) => {
                if (loadedFiles.length) {
                  excalidrawAPI.addFiles(loadedFiles);
                }
                updateStaleImageStatuses({
                  excalidrawAPI,
                  erroredFiles,
                  elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
                });
              });
          }
          // on fresh load, clear unused files from IDB (from previous
          // session)
          LocalData.fileStorage.clearObsoleteFiles({ currentFileIds: fileIds });
        }
      }
    };

    initializeScene({ collabAPI, excalidrawAPI }).then(async (data) => {
      loadImages(data, /* isInitialLoad */ true);
      initialStatePromiseRef.current.promise.resolve(data.scene);
    });

    const onHashChange = async (event: HashChangeEvent) => {
      event.preventDefault();
      const libraryUrlTokens = parseLibraryTokensFromUrl();
      if (!libraryUrlTokens) {
        if (
          collabAPI?.isCollaborating() &&
          !isCollaborationLink(window.location.href)
        ) {
          collabAPI.stopCollaboration(false);
        }
        excalidrawAPI.updateScene({ appState: { isLoading: true } });

        initializeScene({ collabAPI, excalidrawAPI }).then((data) => {
          loadImages(data);
          if (data.scene) {
            excalidrawAPI.updateScene({
              elements: restoreElements(data.scene.elements, null, {
                repairBindings: true,
              }),
              appState: restoreAppState(data.scene.appState, null),
              captureUpdate: CaptureUpdateAction.IMMEDIATELY,
            });
          }
        });
      }
    };

    const syncData = debounce(() => {
      if (isTestEnv()) {
        return;
      }
      if (
        !document.hidden &&
        ((collabAPI && !collabAPI.isCollaborating()) || isCollabDisabled)
      ) {
        // don't sync if local state is newer or identical to browser state
        if (isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_DATA_STATE)) {
          const localDataState = importFromLocalStorage();
          const username = importUsernameFromLocalStorage();
          setLangCode(getPreferredLanguage());
          excalidrawAPI.updateScene({
            ...localDataState,
            captureUpdate: CaptureUpdateAction.NEVER,
          });
          LibraryIndexedDBAdapter.load().then((data) => {
            if (data) {
              excalidrawAPI.updateLibrary({
                libraryItems: data.libraryItems,
              });
            }
          });
          collabAPI?.setUsername(username || "");
        }

        if (isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_FILES)) {
          const elements = excalidrawAPI.getSceneElementsIncludingDeleted();
          const currFiles = excalidrawAPI.getFiles();
          const fileIds =
            elements?.reduce((acc, element) => {
              if (
                isInitializedImageElement(element) &&
                // only load and update images that aren't already loaded
                !currFiles[element.fileId]
              ) {
                return acc.concat(element.fileId);
              }
              return acc;
            }, [] as FileId[]) || [];
          if (fileIds.length) {
            LocalData.fileStorage
              .getFiles(fileIds)
              .then(({ loadedFiles, erroredFiles }) => {
                if (loadedFiles.length) {
                  excalidrawAPI.addFiles(loadedFiles);
                }
                updateStaleImageStatuses({
                  excalidrawAPI,
                  erroredFiles,
                  elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
                });
              });
          }
        }
      }
    }, SYNC_BROWSER_TABS_TIMEOUT);

    const onUnload = () => {
      LocalData.flushSave();
    };

    const visibilityChange = (event: FocusEvent | Event) => {
      if (event.type === EVENT.BLUR || document.hidden) {
        LocalData.flushSave();
      }
      if (
        event.type === EVENT.VISIBILITY_CHANGE ||
        event.type === EVENT.FOCUS
      ) {
        syncData();
      }
    };

    window.addEventListener(EVENT.HASHCHANGE, onHashChange, false);
    window.addEventListener(EVENT.UNLOAD, onUnload, false);
    window.addEventListener(EVENT.BLUR, visibilityChange, false);
    document.addEventListener(EVENT.VISIBILITY_CHANGE, visibilityChange, false);
    window.addEventListener(EVENT.FOCUS, visibilityChange, false);
    return () => {
      window.removeEventListener(EVENT.HASHCHANGE, onHashChange, false);
      window.removeEventListener(EVENT.UNLOAD, onUnload, false);
      window.removeEventListener(EVENT.BLUR, visibilityChange, false);
      window.removeEventListener(EVENT.FOCUS, visibilityChange, false);
      document.removeEventListener(
        EVENT.VISIBILITY_CHANGE,
        visibilityChange,
        false,
      );
    };
  }, [isCollabDisabled, collabAPI, excalidrawAPI, setLangCode]);

  useEffect(() => {
    const unloadHandler = (event: BeforeUnloadEvent) => {
      LocalData.flushSave();

      if (
        excalidrawAPI &&
        LocalData.fileStorage.shouldPreventUnload(
          excalidrawAPI.getSceneElements(),
        )
      ) {
        if (import.meta.env.VITE_APP_DISABLE_PREVENT_UNLOAD !== "true") {
          preventUnload(event);
        } else {
          console.warn(
            "preventing unload disabled (VITE_APP_DISABLE_PREVENT_UNLOAD)",
          );
        }
      }
    };
    window.addEventListener(EVENT.BEFORE_UNLOAD, unloadHandler);
    return () => {
      window.removeEventListener(EVENT.BEFORE_UNLOAD, unloadHandler);
    };
  }, [excalidrawAPI]);

  const onChange = (
    elements: readonly OrderedExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ) => {
    if (collabAPI?.isCollaborating()) {
      collabAPI.syncElements(elements);
    }

    // this check is redundant, but since this is a hot path, it's best
    // not to evaludate the nested expression every time
    if (!LocalData.isSavePaused()) {
      LocalData.save(elements, appState, files, () => {
        if (excalidrawAPI) {
          let didChange = false;

          const elements = excalidrawAPI
            .getSceneElementsIncludingDeleted()
            .map((element) => {
              if (
                LocalData.fileStorage.shouldUpdateImageElementStatus(element)
              ) {
                const newElement = newElementWith(element, { status: "saved" });
                if (newElement !== element) {
                  didChange = true;
                }
                return newElement;
              }
              return element;
            });

          if (didChange) {
            excalidrawAPI.updateScene({
              elements,
              captureUpdate: CaptureUpdateAction.NEVER,
            });
          }
        }
      });
    }

    // Render the debug scene if the debug canvas is available
    if (debugCanvasRef.current && excalidrawAPI) {
      debugRenderer(
        debugCanvasRef.current,
        appState,
        elements,
        window.devicePixelRatio,
      );
    }
  };

  const [latestShareableLink, setLatestShareableLink] = useState<string | null>(
    null,
  );

  const onExportToBackend = async (
    exportedElements: readonly NonDeletedExcalidrawElement[],
    appState: Partial<AppState>,
    files: BinaryFiles,
  ) => {
    if (exportedElements.length === 0) {
      throw new Error(t("alerts.cannotExportEmptyCanvas"));
    }
    try {
      const { url, errorMessage } = await exportToBackend(
        exportedElements,
        {
          ...appState,
          viewBackgroundColor: appState.exportBackground
            ? appState.viewBackgroundColor
            : getDefaultAppState().viewBackgroundColor,
        },
        files,
      );

      if (errorMessage) {
        throw new Error(errorMessage);
      }

      if (url) {
        setLatestShareableLink(url);
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        const { width, height } = appState;
        console.error(error, {
          width,
          height,
          devicePixelRatio: window.devicePixelRatio,
        });
        throw new Error(error.message);
      }
    }
  };

  const renderCustomStats = (
    elements: readonly NonDeletedExcalidrawElement[],
    appState: UIAppState,
  ) => {
    return (
      <CustomStats
        setToast={(message) => excalidrawAPI!.setToast({ message })}
        appState={appState}
        elements={elements}
      />
    );
  };

  const isOffline = useAtomValue(isOfflineAtom);

  const localStorageQuotaExceeded = useAtomValue(localStorageQuotaExceededAtom);

  const onCollabDialogOpen = useCallback(
    () => setShareDialogState({ isOpen: true, type: "collaborationOnly" }),
    [setShareDialogState],
  );

  // browsers generally prevent infinite self-embedding, there are
  // cases where it still happens, and while we disallow self-embedding
  // by not whitelisting our own origin, this serves as an additional guard
  if (isSelfEmbedding) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          height: "100%",
        }}
      >
        <h1>I'm not a pretzel!</h1>
      </div>
    );
  }

  const ExcalidrawPlusCommand = {
    label: "Excalidraw+",
    category: DEFAULT_CATEGORIES.links,
    predicate: true,
    icon: <div style={{ width: 14 }}>{ExcalLogo}</div>,
    keywords: ["plus", "cloud", "server"],
    perform: () => {
      window.open(
        `${
          import.meta.env.VITE_APP_PLUS_LP
        }/plus?utm_source=excalidraw&utm_medium=app&utm_content=command_palette`,
        "_blank",
      );
    },
  };
  const ExcalidrawPlusAppCommand = {
    label: "Sign up",
    category: DEFAULT_CATEGORIES.links,
    predicate: true,
    icon: <div style={{ width: 14 }}>{ExcalLogo}</div>,
    keywords: [
      "excalidraw",
      "plus",
      "cloud",
      "server",
      "signin",
      "login",
      "signup",
    ],
    perform: () => {
      window.open(
        `${
          import.meta.env.VITE_APP_PLUS_APP
        }?utm_source=excalidraw&utm_medium=app&utm_content=command_palette`,
        "_blank",
      );
    },
  };

  return (
    <div
      style={{ height: "100%" }}
      className={clsx("excalidraw-app", {
        "is-collaborating": isCollaborating,
      })}
    >
      <Excalidraw
        excalidrawAPI={excalidrawRefCallback}
        onChange={onChange}
        initialData={initialStatePromiseRef.current.promise}
        isCollaborating={isCollaborating}
        onPointerUpdate={collabAPI?.onPointerUpdate}
        UIOptions={{
          canvasActions: {
            toggleTheme: true,
            export: {
              onExportToBackend,
              renderCustomUI: excalidrawAPI
                ? (elements, appState, files) => {
                    return (
                      <ExportToExcalidrawPlus
                        elements={elements}
                        appState={appState}
                        files={files}
                        name={excalidrawAPI.getName()}
                        onError={(error) => {
                          excalidrawAPI?.updateScene({
                            appState: {
                              errorMessage: error.message,
                            },
                          });
                        }}
                        onSuccess={() => {
                          excalidrawAPI.updateScene({
                            appState: { openDialog: null },
                          });
                        }}
                      />
                    );
                  }
                : undefined,
            },
          },
        }}
        langCode={langCode}
        renderCustomStats={renderCustomStats}
        detectScroll={false}
        handleKeyboardGlobally={true}
        autoFocus={true}
        theme={editorTheme}
        renderTopRightUI={(isMobile) => {
          if (isMobile || !collabAPI || isCollabDisabled) {
            return null;
          }

          return (
            <div className="excalidraw-ui-top-right">
              {excalidrawAPI?.getEditorInterface().formFactor === "desktop" && (
                <ExcalidrawPlusPromoBanner
                  isSignedIn={isExcalidrawPlusSignedUser}
                />
              )}

              {collabError.message && <CollabError collabError={collabError} />}

              <LiveCollaborationTrigger
                isCollaborating={isCollaborating}
                onSelect={() =>
                  setShareDialogState({ isOpen: true, type: "share" })
                }
                editorInterface={editorInterface}
              />
            </div>
          );
        }}
        onLinkOpen={(element, event) => {
          if (element.link && isElementLink(element.link)) {
            event.preventDefault();
            excalidrawAPI?.scrollToContent(element.link, { animate: true });
          }
        }}
      >
        <AppMainMenu
          onCollabDialogOpen={onCollabDialogOpen}
          isCollaborating={isCollaborating}
          isCollabEnabled={!isCollabDisabled}
          theme={appTheme}
          setTheme={(theme) => setAppTheme(theme)}
          refresh={() => forceRefresh((prev) => !prev)}
        />
        <AppWelcomeScreen
          onCollabDialogOpen={onCollabDialogOpen}
          isCollabEnabled={!isCollabDisabled}
        />
        <OverwriteConfirmDialog>
          <OverwriteConfirmDialog.Actions.ExportToImage />
          <OverwriteConfirmDialog.Actions.SaveToDisk />
          {excalidrawAPI && (
            <OverwriteConfirmDialog.Action
              title={t("overwriteConfirm.action.excalidrawPlus.title")}
              actionLabel={t("overwriteConfirm.action.excalidrawPlus.button")}
              onClick={() => {
                exportToExcalidrawPlus(
                  excalidrawAPI.getSceneElements(),
                  excalidrawAPI.getAppState(),
                  excalidrawAPI.getFiles(),
                  excalidrawAPI.getName(),
                );
              }}
            >
              {t("overwriteConfirm.action.excalidrawPlus.description")}
            </OverwriteConfirmDialog.Action>
          )}
        </OverwriteConfirmDialog>
        <AppFooter onChange={() => excalidrawAPI?.refresh()} />
        {excalidrawAPI && <AIComponents excalidrawAPI={excalidrawAPI} />}

        {/* AI Edit button injected into toolbar via tunnel */}
        <AIToolbarTunnelContent excalidrawAPI={excalidrawAPI} />

        {/* AI Manipulation UI - Reference Points Overlay, Shift+Click Handler & Dialog */}
        <AIManipulationUI excalidrawAPI={excalidrawAPI} />

        {/* Coordinate Highlight Overlay - shows crosshair/region when hovering coordinates in AI log */}
        <CoordinateHighlightOverlay excalidrawAPI={excalidrawAPI} />

        <TTDDialogTrigger />
        {isCollaborating && isOffline && (
          <div className="alertalert--warning">
            {t("alerts.collabOfflineWarning")}
          </div>
        )}
        {localStorageQuotaExceeded && (
          <div className="alert alert--danger">
            {t("alerts.localStorageQuotaExceeded")}
          </div>
        )}
        {latestShareableLink && (
          <ShareableLinkDialog
            link={latestShareableLink}
            onCloseRequest={() => setLatestShareableLink(null)}
            setErrorMessage={setErrorMessage}
          />
        )}
        {excalidrawAPI && !isCollabDisabled && (
          <Collab excalidrawAPI={excalidrawAPI} />
        )}

        <ShareDialog
          collabAPI={collabAPI}
          onExportToBackend={async () => {
            if (excalidrawAPI) {
              try {
                await onExportToBackend(
                  excalidrawAPI.getSceneElements(),
                  excalidrawAPI.getAppState(),
                  excalidrawAPI.getFiles(),
                );
              } catch (error: any) {
                setErrorMessage(error.message);
              }
            }
          }}
        />

        <AppSidebar />

        {errorMessage && (
          <ErrorDialog onClose={() => setErrorMessage("")}>
            {errorMessage}
          </ErrorDialog>
        )}

        <CommandPalette
          customCommandPaletteItems={[
            {
              label: t("labels.liveCollaboration"),
              category: DEFAULT_CATEGORIES.app,
              keywords: [
                "team",
                "multiplayer",
                "share",
                "public",
                "session",
                "invite",
              ],
              icon: usersIcon,
              perform: () => {
                setShareDialogState({
                  isOpen: true,
                  type: "collaborationOnly",
                });
              },
            },
            {
              label: t("roomDialog.button_stopSession"),
              category: DEFAULT_CATEGORIES.app,
              predicate: () => !!collabAPI?.isCollaborating(),
              keywords: [
                "stop",
                "session",
                "end",
                "leave",
                "close",
                "exit",
                "collaboration",
              ],
              perform: () => {
                if (collabAPI) {
                  collabAPI.stopCollaboration();
                  if (!collabAPI.isCollaborating()) {
                    setShareDialogState({ isOpen: false });
                  }
                }
              },
            },
            {
              label: t("labels.share"),
              category: DEFAULT_CATEGORIES.app,
              predicate: true,
              icon: share,
              keywords: [
                "link",
                "shareable",
                "readonly",
                "export",
                "publish",
                "snapshot",
                "url",
                "collaborate",
                "invite",
              ],
              perform: async () => {
                setShareDialogState({ isOpen: true, type: "share" });
              },
            },
            {
              label: "GitHub",
              icon: GithubIcon,
              category: DEFAULT_CATEGORIES.links,
              predicate: true,
              keywords: [
                "issues",
                "bugs",
                "requests",
                "report",
                "features",
                "social",
                "community",
              ],
              perform: () => {
                window.open(
                  "https://github.com/excalidraw/excalidraw",
                  "_blank",
                  "noopener noreferrer",
                );
              },
            },
            {
              label: t("labels.followUs"),
              icon: XBrandIcon,
              category: DEFAULT_CATEGORIES.links,
              predicate: true,
              keywords: ["twitter", "contact", "social", "community"],
              perform: () => {
                window.open(
                  "https://x.com/excalidraw",
                  "_blank",
                  "noopener noreferrer",
                );
              },
            },
            {
              label: t("labels.discordChat"),
              category: DEFAULT_CATEGORIES.links,
              predicate: true,
              icon: DiscordIcon,
              keywords: [
                "chat",
                "talk",
                "contact",
                "bugs",
                "requests",
                "report",
                "feedback",
                "suggestions",
                "social",
                "community",
              ],
              perform: () => {
                window.open(
                  "https://discord.gg/UexuTaE",
                  "_blank",
                  "noopener noreferrer",
                );
              },
            },
            {
              label: "YouTube",
              icon: youtubeIcon,
              category: DEFAULT_CATEGORIES.links,
              predicate: true,
              keywords: ["features", "tutorials", "howto", "help", "community"],
              perform: () => {
                window.open(
                  "https://youtube.com/@excalidraw",
                  "_blank",
                  "noopener noreferrer",
                );
              },
            },
            ...(isExcalidrawPlusSignedUser
              ? [
                  {
                    ...ExcalidrawPlusAppCommand,
                    label: "Sign in / Go to Excalidraw+",
                  },
                ]
              : [ExcalidrawPlusCommand, ExcalidrawPlusAppCommand]),

            {
              label: t("overwriteConfirm.action.excalidrawPlus.button"),
              category: DEFAULT_CATEGORIES.export,
              icon: exportToPlus,
              predicate: true,
              keywords: ["plus", "export", "save", "backup"],
              perform: () => {
                if (excalidrawAPI) {
                  exportToExcalidrawPlus(
                    excalidrawAPI.getSceneElements(),
                    excalidrawAPI.getAppState(),
                    excalidrawAPI.getFiles(),
                    excalidrawAPI.getName(),
                  );
                }
              },
            },
            {
              ...CommandPalette.defaultItems.toggleTheme,
              perform: () => {
                setAppTheme(
                  editorTheme === THEME.DARK ? THEME.LIGHT : THEME.DARK,
                );
              },
            },
            {
              label: t("labels.installPWA"),
              category: DEFAULT_CATEGORIES.app,
              predicate: () => !!pwaEvent,
              perform: () => {
                if (pwaEvent) {
                  pwaEvent.prompt();
                  pwaEvent.userChoice.then(() => {
                    // event cannot be reused, but we'll hopefully
                    // grab new one as the event should be fired again
                    pwaEvent = null;
                  });
                }
              },
            },
          ]}
        />
        {isVisualDebuggerEnabled() && excalidrawAPI && (
          <DebugCanvas
            appState={excalidrawAPI.getAppState()}
            scale={window.devicePixelRatio}
            ref={debugCanvasRef}
          />
        )}
      </Excalidraw>
    </div>
  );
};

const ExcalidrawApp = () => {
  const isCloudExportWindow =
    window.location.pathname === "/excalidraw-plus-export";
  if (isCloudExportWindow) {
    return <ExcalidrawPlusIframeExport />;
  }

  return (
    <TopErrorBoundary>
      <Provider store={appJotaiStore}>
        <CoordinateHighlightProvider>
          <AIManipulationProvider>
            <ExcalidrawWrapper />
          </AIManipulationProvider>
        </CoordinateHighlightProvider>
      </Provider>
    </TopErrorBoundary>
  );
};

export default ExcalidrawApp;
