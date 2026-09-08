import React, { useState, useEffect, useCallback } from "react";

import {
  loadPDFDocument,
  getPDFInfo,
  pdfPageToDataURL,
  pdfPageToFile,
  type PDFDocumentInfo,
} from "../data/pdfUtils";

import Spinner from "./Spinner";

import "./PDFPageSelector.scss";

import type { PDFDocumentProxy } from "pdfjs-dist";

export interface PDFPageSelectorProps {
  file: File;
  onPageSelected: (file: File) => void;
  onCancel: () => void;
}

// Quality scale options
const QUALITY_OPTIONS = [
  { label: "Low", scale: 1 },
  { label: "Medium", scale: 2 },
  { label: "High", scale: 3 },
  { label: "Very High", scale: 4 },
];

export const PDFPageSelector: React.FC<PDFPageSelectorProps> = ({
  file,
  onPageSelected,
  onCancel,
}) => {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pdfInfo, setPdfInfo] = useState<PDFDocumentInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quality, setQuality] = useState(2); // Default to Medium

  // Load PDF document
  useEffect(() => {
    let mounted = true;

    const loadPDF = async () => {
      try {
        setLoading(true);
        setError(null);

        const pdfDoc = await loadPDFDocument(file);
        if (!mounted) {
          pdfDoc.destroy();
          return;
        }

        setPdf(pdfDoc);
        const info = await getPDFInfo(pdfDoc);
        if (!mounted) {
          return;
        }

        setPdfInfo(info);
        setLoading(false);
      } catch (err) {
        if (!mounted) {
          return;
        }
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load PDF";
        setError(errorMessage);
        setLoading(false);
      }
    };

    loadPDF();

    return () => {
      mounted = false;
    };
  }, [file]);

  // Cleanup PDF on unmount
  useEffect(() => {
    return () => {
      if (pdf) {
        pdf.destroy();
      }
    };
  }, [pdf]);

  // Load preview when page changes
  useEffect(() => {
    if (!pdf || !pdfInfo) {
      return;
    }

    let mounted = true;

    const loadPreview = async () => {
      try {
        setLoadingPreview(true);
        // Use scale 1 for preview (faster)
        const dataUrl = await pdfPageToDataURL(pdf, currentPage, 1);
        if (mounted) {
          setPreviewUrl(dataUrl);
        }
      } catch (err) {
        console.error("Error loading preview:", err);
      } finally {
        if (mounted) {
          setLoadingPreview(false);
        }
      }
    };

    loadPreview();

    return () => {
      mounted = false;
    };
  }, [pdf, pdfInfo, currentPage]);

  // Handle page selection
  const handleSelectPage = useCallback(async () => {
    if (!pdf) {
      return;
    }

    try {
      setConverting(true);
      const imageFile = await pdfPageToFile(
        pdf,
        currentPage,
        file.name,
        quality,
      );
      onPageSelected(imageFile);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to convert page";
      setError(errorMessage);
      setConverting(false);
    }
  }, [pdf, currentPage, file.name, quality, onPageSelected]);

  // Navigation
  const goToPage = (page: number) => {
    if (!pdfInfo || page < 1 || page > pdfInfo.numPages) {
      return;
    }
    setCurrentPage(page);
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !converting) {
      onCancel();
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !converting) {
        onCancel();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, converting]);

  const renderContent = () => {
    if (error) {
      return (
        <div className="PDFPageSelector__error">
          <p>{error}</p>
          <button
            className="PDFPageSelector__button PDFPageSelector__button--secondary"
            onClick={onCancel}
          >
            Close
          </button>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="PDFPageSelector__loading">
          <Spinner size="2em" />
          <p>Loading PDF document...</p>
        </div>
      );
    }

    return (
      <>
        <p className="PDFPageSelector__description">
          Choose which page to import as an image
        </p>

        {/* Preview */}
        <div className="PDFPageSelector__preview">
          {loadingPreview ? (
            <div className="PDFPageSelector__previewLoading">
              <Spinner size="1.5em" />
              <span>Loading preview...</span>
            </div>
          ) : previewUrl ? (
            <img
              src={previewUrl}
              alt={`Page ${currentPage} preview`}
              className="PDFPageSelector__previewImage"
            />
          ) : (
            <div className="PDFPageSelector__previewPlaceholder">
              Preview will appear here
            </div>
          )}
        </div>

        {/* Page Navigation */}
        <div className="PDFPageSelector__navigation">
          <button
            className="PDFPageSelector__navButton"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1 || converting}
            title="Previous page"
          >
            &lt;
          </button>

          <div className="PDFPageSelector__pageInfo">
            <span>Page</span>
            <input
              type="number"
              className="PDFPageSelector__pageInput"
              value={currentPage}
              onChange={(e) => {
                const page = parseInt(e.target.value, 10);
                if (!isNaN(page)) {
                  goToPage(page);
                }
              }}
              min={1}
              max={pdfInfo?.numPages || 1}
              disabled={converting}
            />
            <span>of {pdfInfo?.numPages || 0}</span>
          </div>

          <button
            className="PDFPageSelector__navButton"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= (pdfInfo?.numPages || 0) || converting}
            title="Next page"
          >
            &gt;
          </button>
        </div>

        {/* Quality Selection */}
        <div className="PDFPageSelector__quality">
          <label>Quality:</label>
          <select
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
            disabled={converting}
            className="PDFPageSelector__qualitySelect"
          >
            {QUALITY_OPTIONS.map((opt) => (
              <option key={opt.scale} value={opt.scale}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="PDFPageSelector__actions">
          <button
            className="PDFPageSelector__button PDFPageSelector__button--secondary"
            onClick={onCancel}
            disabled={converting}
          >
            Cancel
          </button>
          <button
            className="PDFPageSelector__button PDFPageSelector__button--primary"
            onClick={handleSelectPage}
            disabled={converting || !pdf}
          >
            {converting ? "Converting..." : "Use This Page"}
          </button>
        </div>
      </>
    );
  };

  return (
    <div className="PDFPageSelector__backdrop" onClick={handleBackdropClick}>
      <div className="PDFPageSelector__modal">
        <div className="PDFPageSelector__header">
          <h2 className="PDFPageSelector__title">
            {error ? "Error Loading PDF" : loading ? "Loading PDF..." : "Select PDF Page"}
          </h2>
          <button
            className="PDFPageSelector__closeButton"
            onClick={onCancel}
            disabled={converting}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="PDFPageSelector__content">{renderContent()}</div>
      </div>
    </div>
  );
};
