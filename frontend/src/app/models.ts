export type Unit = 'pt' | 'mm' | 'cm' | 'in';
export type PageSizeKey = 'A4' | 'A5' | 'A6' | 'Letter' | 'Legal' | 'Custom';
export type ImagePathMode = 'placeholder' | 'file' | 'base64';

export interface CustomFont {
  id: string;
  /** Font family name used in CSS + XSL-FO */
  name: string;
  filename: string;
  /** Base64 data URL */
  dataUrl: string;
  format: 'woff2' | 'woff' | 'truetype' | 'opentype';
}

export interface PageSizePreset {
  key: PageSizeKey;
  label: string;
  widthPt: number;
  heightPt: number;
}

export const PAGE_PRESETS: PageSizePreset[] = [
  { key: 'A4', label: 'A4 (210 × 297 mm)', widthPt: 595, heightPt: 842 },
  { key: 'A5', label: 'A5 (148 × 210 mm)', widthPt: 420, heightPt: 595 },
  { key: 'A6', label: 'A6 (105 × 148 mm)', widthPt: 298, heightPt: 420 },
  { key: 'Letter', label: 'Letter (8.5 × 11 in)', widthPt: 612, heightPt: 792 },
  { key: 'Legal', label: 'Legal (8.5 × 14 in)', widthPt: 612, heightPt: 1008 },
];

export interface BaseElement {
  id: string;
  type: 'text' | 'image';
  /** Position/size in points (pt) — canonical unit */
  xPt: number;
  yPt: number;
  widthPt: number;
  heightPt: number;
  locked?: boolean;
}

export interface TextElement extends BaseElement {
  type: 'text';
  content: string;
  isDynamic: boolean;
  dynamicField: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  color: string;
  align: 'left' | 'center' | 'right';
}

export interface ImageElement extends BaseElement {
  type: 'image';
  /** Data URL (base64) for on-canvas preview */
  dataUrl: string;
  /** Placeholder variable name, e.g. userImage */
  placeholderName: string;
  /** Original filename hint */
  filename: string;
  scaling: 'uniform' | 'non-uniform';
}

export type CanvasElement = TextElement | ImageElement;

export interface PageDoc {
  id: string;
  name: string;
  /** base64 data URL for background preview */
  backgroundDataUrl: string;
  backgroundPlaceholder: string;
  elements: CanvasElement[];
}

export interface DocState {
  pageSizeKey: PageSizeKey;
  widthPt: number;
  heightPt: number;
  unit: Unit;
  imagePathMode: ImagePathMode;
  pages: PageDoc[];
  activePageId: string;
  selectedElementId: string | null;
  zoom: number;
  showGrid: boolean;
  showRulers: boolean;
  customFonts: CustomFont[];
}

export const FONT_FAMILIES = [
  'Times New Roman',
  'Arial',
  'Helvetica',
  'Courier',
  'Courier New',
  'Georgia',
  'Verdana',
  'Palatino',
];

/* Conversions */
export const PT_PER_MM = 2.83464567;
export const PT_PER_CM = 28.3464567;
export const PT_PER_IN = 72;

export function toPt(value: number, unit: Unit): number {
  switch (unit) {
    case 'pt': return value;
    case 'mm': return value * PT_PER_MM;
    case 'cm': return value * PT_PER_CM;
    case 'in': return value * PT_PER_IN;
  }
}

export function fromPt(pt: number, unit: Unit): number {
  switch (unit) {
    case 'pt': return pt;
    case 'mm': return pt / PT_PER_MM;
    case 'cm': return pt / PT_PER_CM;
    case 'in': return pt / PT_PER_IN;
  }
}

/** 1pt = 1.333px (approx 96dpi) — canvas pixel conversion at 100% zoom */
export const PX_PER_PT = 1.3333333;
