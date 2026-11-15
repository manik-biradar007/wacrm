/**
 * Canvas renderer for a stored biodata — a port of the reference biodata
 * site's preview renderer (truebiodata `src/pages/preview.astro`), so an
 * order's preview here looks the same as what the customer sees there.
 *
 * Everything is drawn on a 794×1123 "design" page (A4 at 96 dpi) and scaled
 * to whatever canvas it is given, so the same code produces the on-screen
 * preview, the high-res image, and the PDF page.
 *
 * Browser-only: it needs a real 2D canvas context and `Image` loading.
 */

import type { Template } from "./templates";

export interface BiodataField {
  id: string;
  label?: string;
  visible?: boolean;
}

export interface BiodataSection {
  title: string;
  fields: BiodataField[];
}

/** The biodata document as stored by the biodata backend (`biodataInfo`). */
export interface BiodataInfo {
  biodataTitle?: string;
  profilePicture?: string | null;
  selectedGodIcon?: string;
  godName?: string;
  fields: Record<string, BiodataSection>;
  formData: Record<string, string>;
  pageMode?: "1page" | "2page";
  [key: string]: unknown;
}

export type PageMode = "1page" | "2page";

export const DESIGN_WIDTH = 794;
export const DESIGN_HEIGHT = 1123;

/** Default god icon used when the biodata has none, or its icon fails to load. */
export const DEFAULT_GOD_ICON = "/images/gods/god-img-3.png";

export interface RenderImages {
  bg?: HTMLImageElement;
  god?: HTMLImageElement;
  profile?: HTMLImageElement;
}

export interface RenderOptions {
  info: BiodataInfo;
  template: Template;
  mode: PageMode;
  /** 1-based page number; only meaningful in 2-page mode. */
  page: 1 | 2;
  images: RenderImages;
}

const FONT_FAMILY = "'Google Sans', sans-serif";

/** Load an image; resolves undefined instead of rejecting so one bad asset never blocks a render. */
export function loadImage(src: string, crossOrigin = false): Promise<HTMLImageElement | undefined> {
  return new Promise((resolve) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(undefined);
    img.src = src;
  });
}

/**
 * Loads every image one page render needs (background, god icon, profile
 * photo). `photoSrc` must be same-origin or a data URL, so the canvas stays
 * exportable.
 */
export async function loadRenderImages(
  info: BiodataInfo,
  bgSrc: string,
  photoSrc?: string,
): Promise<RenderImages> {
  const [bg, god, profile] = await Promise.all([
    loadImage(bgSrc),
    loadImage(info.selectedGodIcon || DEFAULT_GOD_ICON),
    photoSrc ? loadImage(photoSrc) : Promise.resolve(undefined),
  ]);
  return {
    bg,
    // Fall back to the default icon when the chosen one is missing.
    god: god ?? (await loadImage(DEFAULT_GOD_ICON)),
    profile,
  };
}

/**
 * Draw one page of the biodata onto `canvas`. The canvas's width decides the
 * output resolution; the layout is always computed against the 794px design
 * width, so the output is identical at any size.
 */
export function renderBiodataPage(canvas: HTMLCanvasElement, opts: RenderOptions): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { info, template, mode, page, images } = opts;
  const scale = canvas.width / DESIGN_WIDTH;

  ctx.fillStyle = template.bg || "#ffffff";
  ctx.fillRect(0, 0, DESIGN_WIDTH * scale, DESIGN_HEIGHT * scale);
  if (images.bg) {
    ctx.drawImage(images.bg, 0, 0, DESIGN_WIDTH * scale, DESIGN_HEIGHT * scale);
  }

  // Four-pass convergence: measure the content height at a guessed scale,
  // then correct the scale until the content fits above the bottom padding.
  const maxY = (DESIGN_HEIGHT - template.padding.bottom) * scale;
  const minScaleFloor = mode === "2page" ? 0.7 : 0.6;
  const correctScale = (measured: number, base: number) => {
    const r = maxY / measured;
    return r >= 1
      ? Math.min(base * r * 0.98, 1.18)
      : Math.max(minScaleFloor, base * r * 0.99);
  };

  const heuristic = calculateContentScale(info, template, mode, page);
  const measure = (s: number) => measureContentHeight(ctx, { info, template, mode, page, images, scale }, s);
  const s1 = correctScale(measure(heuristic), heuristic);
  const s2 = correctScale(measure(s1), s1);
  const s3 = correctScale(measure(s2), s2);
  const finalScale = correctScale(measure(s3), s3);

  drawContent(ctx, { info, template, mode, page, images, scale }, finalScale);
}

/** Number of page sections a biodata produces, given its page mode. */
export function pageCount(mode: PageMode): number {
  return mode === "2page" ? 2 : 1;
}

interface DrawEnv {
  info: BiodataInfo;
  template: Template;
  mode: PageMode;
  page: 1 | 2;
  images: RenderImages;
  scale: number;
}

function calculateContentScale(
  info: BiodataInfo,
  template: Template,
  mode: PageMode,
  page: 1 | 2,
): number {
  if (!info?.fields) return 1;
  const { fields, formData } = info;

  let totalFields = 0;
  let totalContentLength = 0;
  let longFieldCount = 0;

  let activeSections: Array<BiodataSection | undefined> = Object.values(fields);
  if (mode === "2page") {
    activeSections =
      page === 1
        ? [fields.personal_details]
        : [fields.family_details, fields.contact_details];
  }

  for (const section of activeSections) {
    if (!section || !section.fields) continue;
    for (const field of section.fields) {
      const value = formData[field.id];
      const isFieldVisible = field.visible !== false;
      if (value && isFieldVisible) {
        totalFields++;
        const strVal = String(value);
        totalContentLength += strVal.length;
        if (strVal.length > 100 || strVal.includes("\n")) longFieldCount++;
      }
    }
  }

  const paddingBottomScale = (template.padding.bottom || 40) / 2000;

  if (mode === "2page") {
    if (totalFields <= 14) return Math.min(1.1, 1.05 - paddingBottomScale);
    if (totalFields <= 20) return Math.min(1.02, 0.98 - paddingBottomScale);
    return Math.max(0.75, 0.95 - (totalFields - 20) * 0.015);
  }

  if (totalFields <= 8 && totalContentLength <= 300) {
    return Math.min(1.15, 1.1 + (8 - totalFields) * 0.01);
  } else if (totalFields <= 10 && totalContentLength <= 450) {
    return Math.min(1.1, 1.05 + (10 - totalFields) * 0.008);
  } else if (totalFields <= 12 && totalContentLength <= 600 && longFieldCount === 0) {
    return Math.max(1.0, 1.02 - paddingBottomScale);
  }

  let fieldScale = 0;
  if (totalFields > 25) {
    fieldScale = (totalFields - 25) * 0.02;
  } else if (totalFields > 18) {
    fieldScale = (totalFields - 18) * 0.015;
  } else if (totalFields > 12) {
    fieldScale = (totalFields - 12) * 0.01;
  }

  let contentScale = 0;
  if (totalContentLength > 2000) {
    contentScale = (totalContentLength - 2000) * 0.0002;
  } else if (totalContentLength > 1200) {
    contentScale = (totalContentLength - 1200) * 0.00015;
  } else if (totalContentLength > 800) {
    contentScale = (totalContentLength - 800) * 0.0001;
  }

  const longFieldScale = longFieldCount > 3 ? (longFieldCount - 3) * 0.02 : 0;

  return Math.max(0.65, 1 - fieldScale - contentScale - paddingBottomScale - longFieldScale);
}

/** Word-wrap `text` into `maxWidth`, honouring explicit newlines. Returns the next free y. */
function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  // Wrap 2% early so measurement-vs-rendering rounding wraps cleanly.
  const wrapAt = maxWidth * 0.98;
  let currentY = y;
  String(text)
    .split("\n")
    .forEach((segment, lineIdx) => {
      if (lineIdx > 0) currentY += lineHeight;
      const words = segment.split(" ");
      let line = "";

      for (const word of words) {
        const testLine = line + word + " ";
        const testWidth = ctx.measureText(testLine).width;

        if (testWidth > wrapAt) {
          if (line.trim()) {
            ctx.fillText(line.trim(), x, currentY, maxWidth);
            currentY += lineHeight;
            line = word + " ";
          } else {
            // A single word wider than the column: draw it squeezed to fit.
            ctx.fillText(word, x, currentY, maxWidth);
            currentY += lineHeight;
            line = "";
          }
        } else {
          line = testLine;
        }
      }
      if (line.trim()) ctx.fillText(line.trim(), x, currentY, maxWidth);
    });
  return currentY + lineHeight;
}

/**
 * Dry-run the layout with drawing calls muted, to measure the content's
 * height at a given scale. The muted methods are restored afterwards.
 */
function measureContentHeight(
  ctx: CanvasRenderingContext2D,
  env: DrawEnv,
  contentScale: number,
): number {
  const noop = () => {};
  const mocked = [
    "fillText",
    "drawImage",
    "stroke",
    "fill",
    "beginPath",
    "roundRect",
    "clip",
    "save",
    "restore",
  ] as const;
  const originals: Record<string, unknown> = {};
  const target = ctx as unknown as Record<string, unknown>;
  for (const m of mocked) {
    originals[m] = target[m];
    target[m] = noop;
  }
  try {
    return drawContent(ctx, env, contentScale);
  } finally {
    for (const m of mocked) {
      target[m] = originals[m];
    }
  }
}

/** Lays out and paints one page at `forcedContentScale`. Returns the final y. */
function drawContent(ctx: CanvasRenderingContext2D, env: DrawEnv, forcedContentScale: number): number {
  const { info, template, mode, page, images, scale } = env;
  const { biodataTitle, godName, fields, formData } = info;
  const contentScale = forcedContentScale;

  const LABEL_WIDTH = 170 * scale;
  const VALUE_OFFSET = 170 * scale;
  const LABEL_SAFE_WIDTH = LABEL_WIDTH - 12 * scale;

  const TITLE_FONT_SIZE = 24 * scale * Math.max(contentScale, 0.85);
  const SECTION_FONT_SIZE = 22 * scale * Math.max(contentScale, 0.85);
  const FIELD_FONT_SIZE = 17 * scale * contentScale;

  const cs = Math.max(0.6, Math.min(1.1, contentScale));
  const t = (cs - 0.6) / 0.5;
  const lineHeightMultiplier = 1.25 + t * 0.15;
  const TEXT_LINE_HEIGHT = FIELD_FONT_SIZE * lineHeightMultiplier;
  const FIELD_SPACING = (3 + t * 2) * scale * contentScale;
  const SECTION_BOTTOM_SPACING = (12 + t * 4) * scale * contentScale;
  const SECTION_HEADER_SPACING = Math.max(
    SECTION_FONT_SIZE * (1.15 + t * 0.15),
    (22 + t * 6) * scale * contentScale,
  );

  const actualPhotoWidth = template.photoWidth;
  const godSize = 60 * scale;
  const headerGap = 10 * scale * Math.max(contentScale, 0.85);
  const HEADER_BOTTOM_SPACING = (template.headerBottomSpacing ?? 1) * 32 * scale * contentScale;

  ctx.imageSmoothingEnabled = true;
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = "high";

  let yPos = template.padding.top * scale;
  const leftMargin = template.padding.left * scale;
  const contentWidth = (DESIGN_WIDTH - template.padding.left - template.padding.right) * scale;
  const headerCenterX = (DESIGN_WIDTH / 2 + (template.headerOffsetX ?? 0)) * scale;

  const godImg = images.god;
  const isPage2 = mode === "2page" && page === 2;

  let contentStartY = yPos;

  // Page 1's header height, so page 2 starts at the same content top margin.
  const headerTopY = yPos;
  let page1HeaderHeight = 0;
  if (godImg) page1HeaderHeight += godSize + headerGap;
  page1HeaderHeight += TITLE_FONT_SIZE + headerGap + TITLE_FONT_SIZE;
  const expectedContentStartY = headerTopY + page1HeaderHeight + HEADER_BOTTOM_SPACING;

  ctx.fillStyle = template.titleColor;
  ctx.font = `bold ${TITLE_FONT_SIZE}px ${FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  if (!isPage2) {
    if (godImg) {
      ctx.drawImage(godImg, headerCenterX - godSize / 2, yPos, godSize, godSize);
      yPos += godSize + headerGap;
    }

    yPos = drawText(ctx, biodataTitle || "परिचय पत्र", headerCenterX, yPos, contentWidth, TITLE_FONT_SIZE);
    yPos += headerGap;

    yPos = drawText(ctx, godName || "॥ श्री गणेशाय नमः ॥", headerCenterX, yPos, contentWidth, TITLE_FONT_SIZE);

    ctx.textBaseline = "alphabetic";
    yPos += HEADER_BOTTOM_SPACING;
    contentStartY = yPos;

    // Profile photo: page 1 (or 1-page mode) only.
    const profileImg = images.profile;
    if (profileImg) {
      const photoHeight = actualPhotoWidth * 1.25;
      const x = (DESIGN_WIDTH - template.padding.right - template.photoPos.x - actualPhotoWidth) * scale;
      const y = contentStartY + template.photoPos.y * scale;
      const width = actualPhotoWidth * scale;
      const height = photoHeight * scale;
      const border = template.photoBorder;
      const radius = border.radius * scale;

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, radius);
      ctx.clip();
      ctx.drawImage(profileImg, x, y, width, height);
      ctx.restore();

      ctx.strokeStyle = border.color;
      ctx.lineWidth = border.width * scale;
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, radius);
      ctx.stroke();
    }
  } else {
    // Page 2: no photo, no title — just the auspicious line, centred in the header band.
    const auspiciousText = godName || "॥ श्री गणेशाय नमः ॥";
    const headerAvailableSpace = expectedContentStartY - HEADER_BOTTOM_SPACING - headerTopY;
    const auspiciousY = headerTopY + Math.max(0, (headerAvailableSpace - TITLE_FONT_SIZE) / 2);

    drawText(ctx, auspiciousText, headerCenterX, auspiciousY, contentWidth, TITLE_FONT_SIZE);

    ctx.textBaseline = "alphabetic";
    contentStartY = expectedContentStartY;
    yPos = contentStartY;
  }

  let sectionOrder = ["personal_details", "family_details", "contact_details"];
  if (mode === "2page") {
    sectionOrder = page === 1 ? ["personal_details"] : ["family_details", "contact_details"];
  }

  const profileImg = !isPage2 ? images.profile : undefined;
  const actualPhotoHeight = actualPhotoWidth * 1.25;
  const photoBottom = contentStartY + (template.photoPos.y + actualPhotoHeight) * scale;
  const photoStartX = (DESIGN_WIDTH - template.padding.right - template.photoPos.x - actualPhotoWidth) * scale;

  sectionOrder.forEach((sectionKey) => {
    if (!fields[sectionKey]) return;
    const section = fields[sectionKey];

    const visibleFields = section.fields.filter((field) => {
      const value = formData[field.id];
      return value && field.visible !== false;
    });
    if (visibleFields.length === 0) return;

    ctx.fillStyle = template.sectionColor;
    ctx.font = `bold ${SECTION_FONT_SIZE}px ${FONT_FAMILY}`;
    ctx.textAlign = "left";
    ctx.fillText(section.title, leftMargin, yPos, contentWidth);
    yPos += SECTION_HEADER_SPACING;

    ctx.font = `${FIELD_FONT_SIZE}px ${FONT_FAMILY}`;

    visibleFields.forEach((field) => {
      const value = formData[field.id];
      const startY = yPos;
      const labelText = (field.label || "").trim();
      const hasLabel = labelText.length > 0;
      const valueX = hasLabel ? leftMargin + VALUE_OFFSET : leftMargin;

      if (hasLabel) {
        ctx.fillStyle = template.labelColor;
        ctx.font = `500 ${FIELD_FONT_SIZE}px ${FONT_FAMILY}`;
        const labelWidth = ctx.measureText(labelText).width;
        if (labelWidth > LABEL_SAFE_WIDTH) {
          yPos = drawText(ctx, labelText, leftMargin, yPos, LABEL_SAFE_WIDTH, TEXT_LINE_HEIGHT);
        } else {
          ctx.fillText(labelText, leftMargin, yPos, LABEL_SAFE_WIDTH);
        }
        ctx.fillText(":", valueX - 10 * scale, startY);
      }

      ctx.fillStyle = template.valueColor;
      ctx.font = `400 ${FIELD_FONT_SIZE}px ${FONT_FAMILY}`;
      const photoOverlap = profileImg && startY < photoBottom;
      const availableWidth = contentWidth - (valueX - leftMargin);
      const textWidth = photoOverlap ? photoStartX - valueX - 10 * scale : availableWidth;

      yPos = Math.max(yPos, drawText(ctx, String(value), valueX, startY, textWidth, TEXT_LINE_HEIGHT));
      yPos += FIELD_SPACING;
    });

    yPos += SECTION_BOTTOM_SPACING;
  });

  return yPos;
}
