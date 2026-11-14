"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Download, Loader2, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  renderBiodataPage,
  loadRenderImages,
  pageCount,
  DEFAULT_GOD_ICON,
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  type BiodataInfo,
  type PageMode,
  type RenderImages,
} from "@/lib/biodata/render";
import {
  templates,
  DEFAULT_TEMPLATE_KEY,
  getTemplateById,
  type Template,
} from "@/lib/biodata/templates";

export type OrderBiodataFormat = "image" | "pdf" | "word";

/** Attachment kind the dialog should stage the file as (matches the WhatsApp message type). */
export type StagedKind = "image" | "document";

interface OrderBiodataPreviewProps {
  paymentId: string;
  /** Hands a generated file to the dialog, which uploads it and stages it for sending. */
  onAttach: (file: File, kind: StagedKind) => void;
}

/** On-screen preview resolution (2× the 794px design width). */
const PREVIEW_SCALE = 2;
/** Export resolution for image/PDF downloads (3× — matches the reference's high-res render). */
const EXPORT_SCALE = 3;
/** JPEG quality for image/PDF output. */
const JPEG_QUALITY = 0.92;
/** WhatsApp caps image messages at 5 MB; a 2-page image attach is not a single file. */
const IMAGE_ATTACH_MAX_BYTES = 5 * 1024 * 1024;

type DetailState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error" }
  | {
      status: "ready";
      info: BiodataInfo;
      template: Template;
      mode: PageMode;
      images: RenderImages;
    };

function resolveTemplate(id: string | undefined): Template {
  return getTemplateById(id ?? "") ?? templates[id ?? ""] ?? templates[DEFAULT_TEMPLATE_KEY];
}

/**
 * The god icon as a base64 data URL, which the Word converter expects. The
 * icon is a same-origin static asset, so the browser fetches it directly.
 */
async function godIconAsDataUrl(path: string | undefined): Promise<string> {
  const source = path || DEFAULT_GOD_ICON;
  if (source.startsWith("data:")) return source;
  const res = await fetch(source);
  if (!res.ok) throw new Error("Couldn't load the god icon.");
  const blob = await res.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  return dataUrl.startsWith("data:image/") ? dataUrl : dataUrl.replace(/^data:[^;]*;/, "data:image/png;");
}

function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode image."))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

/** Saves a generated file to the agent's machine. */
function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function OrderBiodataPreview({ paymentId, onAttach }: OrderBiodataPreviewProps) {
  const t = useTranslations("Inbox.orderSearch.preview");
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [busy, setBusy] = useState<{ format: OrderBiodataFormat; action: "download" | "attach" } | null>(null);
  const previewRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  // Files already generated for this order, so Download and Attach on the
  // same format don't re-render (or re-convert) the biodata twice.
  const fileCache = useRef(new Map<OrderBiodataFormat, File[]>());

  // Fetch the biodata for the selected order.
  useEffect(() => {
    let cancelled = false;
    fileCache.current.clear();
    setState({ status: "loading" });

    (async () => {
      try {
        const res = await fetch(`/api/orders/biodata?paymentId=${encodeURIComponent(paymentId)}`);
        if (cancelled) return;
        if (res.status === 404) {
          setState({ status: "missing" });
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { template?: string; biodataInfo: BiodataInfo };
        const info = data.biodataInfo;
        const template = resolveTemplate(data.template);
        const mode: PageMode = info.pageMode === "2page" ? "2page" : "1page";
        const images = await loadRenderImages(info, template.bgImage);
        if (cancelled) return;
        setState({ status: "ready", info, template, mode, images });
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [paymentId]);

  // Paint the on-screen preview once the biodata is loaded.
  useEffect(() => {
    if (state.status !== "ready") return;
    const pages = pageCount(state.mode);
    for (let p = 1; p <= pages; p++) {
      const canvas = previewRefs.current[p - 1];
      if (!canvas) continue;
      canvas.width = DESIGN_WIDTH * PREVIEW_SCALE;
      canvas.height = DESIGN_HEIGHT * PREVIEW_SCALE;
      renderBiodataPage(canvas, {
        info: state.info,
        template: state.template,
        mode: state.mode,
        page: p as 1 | 2,
        images: state.images,
      });
    }
  }, [state]);

  /** Renders one page at export resolution onto an off-screen canvas. */
  const renderExportPage = useCallback(
    (page: 1 | 2): HTMLCanvasElement => {
      if (state.status !== "ready") throw new Error("Biodata not loaded.");
      const canvas = document.createElement("canvas");
      canvas.width = DESIGN_WIDTH * EXPORT_SCALE;
      canvas.height = DESIGN_HEIGHT * EXPORT_SCALE;
      renderBiodataPage(canvas, {
        info: state.info,
        template: state.template,
        mode: state.mode,
        page,
        images: state.images,
      });
      return canvas;
    },
    [state],
  );

  /** Produces the file(s) for one format. Image is one JPEG per page; PDF and Word are one file. */
  const buildFiles = useCallback(
    async (format: OrderBiodataFormat): Promise<File[]> => {
      if (state.status !== "ready") throw new Error("Biodata not loaded.");
      const pages = pageCount(state.mode);

      if (format === "image") {
        const files: File[] = [];
        for (let p = 1; p <= pages; p++) {
          const blob = await canvasToJpegBlob(renderExportPage(p as 1 | 2));
          const name = pages > 1 ? `biodata-${paymentId}-page-${p}.jpg` : `biodata-${paymentId}.jpg`;
          files.push(new File([blob], name, { type: "image/jpeg" }));
        }
        return files;
      }

      if (format === "pdf") {
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF("p", "mm", "a4");
        for (let p = 1; p <= pages; p++) {
          if (p > 1) pdf.addPage();
          const dataUrl = renderExportPage(p as 1 | 2).toDataURL("image/jpeg", JPEG_QUALITY);
          pdf.addImage(dataUrl, "JPEG", 0, 0, 210, 297, undefined, "FAST");
        }
        const blob = pdf.output("blob");
        return [new File([blob], `biodata-${paymentId}.pdf`, { type: "application/pdf" })];
      }

      // Word: converted server-side by the docx service. The god icon is
      // inlined here from this origin, as the reference site does.
      const res = await fetch("/api/orders/biodata/word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId,
          selectedGodIcon: await godIconAsDataUrl(state.info.selectedGodIcon),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      return [
        new File([blob], `biodata-${paymentId}.docx`, {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
      ];
    },
    [state, paymentId, renderExportPage],
  );

  const getFiles = useCallback(
    async (format: OrderBiodataFormat): Promise<File[]> => {
      const cached = fileCache.current.get(format);
      if (cached) return cached;
      const files = await buildFiles(format);
      fileCache.current.set(format, files);
      return files;
    },
    [buildFiles],
  );

  const handleDownload = useCallback(
    async (format: OrderBiodataFormat) => {
      if (busy) return;
      setBusy({ format, action: "download" });
      try {
        const files = await getFiles(format);
        files.forEach(downloadFile);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("generateError", { format: t(`formats.${format}`) }));
      } finally {
        setBusy(null);
      }
    },
    [busy, getFiles, t],
  );

  const handleAttach = useCallback(
    async (format: OrderBiodataFormat) => {
      if (busy) return;
      setBusy({ format, action: "attach" });
      try {
        const files = await getFiles(format);
        const [file] = files;
        if (!file) return;
        const kind: StagedKind = format === "image" ? "image" : "document";
        if (kind === "image" && file.size > IMAGE_ATTACH_MAX_BYTES) {
          toast.error(t("imageTooLarge", { max: Math.round(IMAGE_ATTACH_MAX_BYTES / 1024 / 1024) }));
          return;
        }
        onAttach(file, kind);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("generateError", { format: t(`formats.${format}`) }));
      } finally {
        setBusy(null);
      }
    },
    [busy, getFiles, onAttach, t],
  );

  if (state.status === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-muted/40 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("loading")}
      </div>
    );
  }

  if (state.status === "missing") {
    return (
      <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
        {t("missing")}
      </p>
    );
  }

  if (state.status === "error") {
    return (
      <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
        {t("error")}
      </p>
    );
  }

  const pages = pageCount(state.mode);
  const formats: OrderBiodataFormat[] = ["image", "pdf", "word"];

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        {Array.from({ length: pages }, (_, i) => (
          <div key={i} className="space-y-1">
            {pages > 1 && (
              <p className="text-xs font-medium text-muted-foreground">{t("pageLabel", { page: i + 1 })}</p>
            )}
            <canvas
              ref={(el) => {
                previewRefs.current[i] = el;
              }}
              className="w-full rounded-md border border-border bg-white shadow-sm"
              style={{ aspectRatio: `${DESIGN_WIDTH} / ${DESIGN_HEIGHT}` }}
            />
          </div>
        ))}
      </div>

      <div className="divide-y divide-border rounded-lg border border-border">
        {formats.map((format) => {
          // WhatsApp images can't carry a multi-page biodata; the PDF is the
          // single-file option for 2-page layouts.
          const attachDisabled = format === "image" && pages > 1;
          const isBusy = busy?.format === format;
          return (
            <div key={format} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="text-sm font-medium text-foreground">{t(`formats.${format}`)}</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  disabled={!!busy}
                  onClick={() => handleDownload(format)}
                >
                  {isBusy && busy?.action === "download" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  {t("download")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs text-primary"
                  disabled={!!busy || attachDisabled}
                  title={attachDisabled ? t("imageNeedsPdf") : undefined}
                  onClick={() => handleAttach(format)}
                >
                  {isBusy && busy?.action === "attach" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Paperclip className="h-3.5 w-3.5" />
                  )}
                  {t("attach")}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      {pages > 1 && <p className="text-xs text-muted-foreground">{t("imageNeedsPdf")}</p>}
    </div>
  );
}
