import * as pdfjsLib from "pdfjs-dist";

import type { PDFDocumentProxy } from "pdfjs-dist";

// Configure PDF.js worker - use CDN for reliability
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/**
 * PDF Utilities
 *
 * Provides functionality to load, render, and convert PDF pages to images.
 * Uses pdfjs-dist for PDF parsing and rendering.
 */

export interface PDFPageInfo {
  pageNumber: number;
  width: number;
  height: number;
}

export interface PDFDocumentInfo {
  numPages: number;
  pages: PDFPageInfo[];
}

/**
 * Check if a file is a PDF based on extension or MIME type.
 */
export const isPdfFile = (file: File): boolean => {
  const fileName = file.name.toLowerCase();
  if (fileName.endsWith(".pdf")) {
    return true;
  }

  if (file.type === "application/pdf") {
    return true;
  }

  return false;
};

/**
 * Load a PDF document from a file.
 */
export async function loadPDFDocument(file: File): Promise<PDFDocumentProxy> {
  const arrayBuffer = await file.arrayBuffer();

  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    verbosity: 0, // Suppress logging
  });

  return loadingTask.promise;
}

/**
 * Get information about all pages in a PDF.
 */
export async function getPDFInfo(
  pdf: PDFDocumentProxy,
): Promise<PDFDocumentInfo> {
  const pages: PDFPageInfo[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });

    pages.push({
      pageNumber: i,
      width: viewport.width,
      height: viewport.height,
    });
  }

  return {
    numPages: pdf.numPages,
    pages,
  };
}

/**
 * Render a PDF page to a canvas element.
 */
export async function renderPDFPage(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  scale: number = 2, // Higher scale for better quality
): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not get canvas context");
  }

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const renderContext = {
    canvasContext: context,
    viewport,
  };

  await page.render(renderContext).promise;

  return canvas;
}

/**
 * Convert a PDF page to an image data URL.
 */
export async function pdfPageToDataURL(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  scale: number = 2,
  format: "png" | "jpeg" = "png",
  quality: number = 0.92,
): Promise<string> {
  const canvas = await renderPDFPage(pdf, pageNumber, scale);

  if (format === "jpeg") {
    return canvas.toDataURL("image/jpeg", quality);
  }

  return canvas.toDataURL("image/png");
}

/**
 * Convert a PDF page to a File object.
 */
export async function pdfPageToFile(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  originalFileName: string,
  scale: number = 2,
): Promise<File> {
  const canvas = await renderPDFPage(pdf, pageNumber, scale);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to convert PDF page to blob"));
          return;
        }

        // Create filename based on original PDF name
        const baseName = originalFileName.replace(/\.pdf$/i, "");
        const fileName = `${baseName}_page${pageNumber}.png`;

        const file = new File([blob], fileName, {
          type: "image/png",
          lastModified: Date.now(),
        });

        resolve(file);
      },
      "image/png",
      1.0,
    );
  });
}
