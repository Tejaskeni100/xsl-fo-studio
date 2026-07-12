import { Injectable } from '@angular/core';
import { DocState, PageDoc, CanvasElement, TextElement, ImageElement, ImagePathMode } from './models';

/**
 * Parses XSL-FO 1.0 XML back into DocState.
 * Optimized for the round-trip format produced by XslFoGenerator, but tolerant
 * of common variations (whitespace, missing optional attrs).
 * Throws on malformed XML — caller should display error toast.
 */
@Injectable({ providedIn: 'root' })
export class XslFoParser {

  parse(xml: string, current: DocState): DocState {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');
    const parserError = doc.querySelector('parsererror');
    if (parserError) throw new Error('Invalid XML: ' + parserError.textContent);

    const root = doc.documentElement;
    if (!root || root.localName !== 'root') {
      throw new Error('Expected <fo:root> as root element');
    }

    // Page master: use first simple-page-master's page-width / page-height
    const pageMaster = doc.getElementsByTagNameNS('*', 'simple-page-master')[0];
    if (!pageMaster) throw new Error('No <fo:simple-page-master> found');
    const widthPt = parseDim(pageMaster.getAttribute('page-width'), current.widthPt);
    const heightPt = parseDim(pageMaster.getAttribute('page-height'), current.heightPt);

    // Detect image path mode from first external-graphic src attribute
    const imgs = Array.from(doc.getElementsByTagNameNS('*', 'external-graphic'));
    let imagePathMode: ImagePathMode = current.imagePathMode;
    if (imgs.length > 0) {
      const firstSrc = imgs[0].getAttribute('src') || '';
      if (firstSrc.startsWith('data:')) imagePathMode = 'base64';
      else if (firstSrc.startsWith('file://')) imagePathMode = 'file';
      else if (firstSrc.startsWith('{')) imagePathMode = 'placeholder';
    }

    // Page sequences → pages
    const seqs = Array.from(doc.getElementsByTagNameNS('*', 'page-sequence'));
    const pages: PageDoc[] = seqs.map((seq, idx) => this.parsePage(seq, current.pages[idx], idx));
    if (pages.length === 0) throw new Error('No <fo:page-sequence> found');

    return {
      ...current,
      widthPt,
      heightPt,
      pageSizeKey: 'Custom',
      imagePathMode,
      pages,
      activePageId: pages[0].id,
      selectedElementId: null,
    };
  }

  private parsePage(seq: Element, existing: PageDoc | undefined, idx: number): PageDoc {
    const id = existing?.id ?? `page-${idx}-${Math.random().toString(36).slice(2, 8)}`;
    const name = existing?.name ?? `Page ${idx + 1}`;

    // Root block-container inside flow
    const flow = seq.getElementsByTagNameNS('*', 'flow')[0];
    if (!flow) return { id, name, backgroundDataUrl: '', backgroundPlaceholder: 'backgroundImage', elements: [] };

    const rootContainer = firstChildLocal(flow, 'block-container');
    if (!rootContainer) return { id, name, backgroundDataUrl: '', backgroundPlaceholder: 'backgroundImage', elements: [] };

    // Iterate direct block-container children — first that spans full page & has an <fo:external-graphic> is background
    let backgroundDataUrl = existing?.backgroundDataUrl ?? '';
    let backgroundPlaceholder = existing?.backgroundPlaceholder ?? 'backgroundImage';
    const elements: CanvasElement[] = [];

    const childContainers = Array.from(rootContainer.children).filter(c => c.localName === 'block-container');
    let treatedFirstAsBg = false;
    childContainers.forEach((c, i) => {
      const top = parseDim(c.getAttribute('top'), 0);
      const left = parseDim(c.getAttribute('left'), 0);
      const width = parseDim(c.getAttribute('width'), 0);
      const height = parseDim(c.getAttribute('height'), 0);

      const ext = c.getElementsByTagNameNS('*', 'external-graphic')[0];

      // First one at 0,0 with full page dims and an external-graphic → background
      if (!treatedFirstAsBg && i === 0 && ext && top === 0 && left === 0) {
        const src = ext.getAttribute('src') || '';
        if (src.startsWith('data:')) backgroundDataUrl = src;
        const m = src.match(/^\{([^}]+)\}$/);
        if (m && m[1]) backgroundPlaceholder = m[1];
        treatedFirstAsBg = true;
        return;
      }

      if (ext) {
        const src = ext.getAttribute('src') || '';
        const placeholderMatch = src.match(/^\{([^}]+)\}$/);
        const el: ImageElement = {
          id: `img-${Math.random().toString(36).slice(2, 9)}`,
          type: 'image',
          xPt: left, yPt: top, widthPt: width, heightPt: height,
          dataUrl: src.startsWith('data:') ? src : '',
          placeholderName: placeholderMatch ? placeholderMatch[1] : 'userImage',
          filename: '',
          scaling: (ext.getAttribute('scaling') as any) || 'uniform',
        };
        elements.push(el);
        return;
      }

      // Otherwise: expect a text block inside
      const block = c.getElementsByTagNameNS('*', 'block')[0];
      if (!block) return;

      const valueOf = block.getElementsByTagNameNS('*', 'value-of')[0];
      const isDynamic = !!valueOf;
      const dynField = valueOf?.getAttribute('select') || 'fieldName';

      // Static content: either <xsl:text> or raw text
      let content = '';
      if (!isDynamic) {
        const xslText = block.getElementsByTagNameNS('*', 'text')[0];
        content = xslText ? (xslText.textContent || '') : (block.textContent || '').trim();
      }

      const el: TextElement = {
        id: `txt-${Math.random().toString(36).slice(2, 9)}`,
        type: 'text',
        xPt: left, yPt: top, widthPt: width, heightPt: height,
        content: content || '',
        isDynamic,
        dynamicField: dynField,
        fontFamily: block.getAttribute('font-family') || 'Helvetica',
        fontSize: parseDim(block.getAttribute('font-size'), 14),
        fontWeight: (block.getAttribute('font-weight') as any) || 'normal',
        fontStyle: (block.getAttribute('font-style') as any) || 'normal',
        color: block.getAttribute('color') || '#111111',
        align: (block.getAttribute('text-align') as any) || 'left',
      };
      elements.push(el);
    });

    return { id, name, backgroundDataUrl, backgroundPlaceholder, elements };
  }
}

function firstChildLocal(parent: Element, name: string): Element | null {
  for (const c of Array.from(parent.children)) {
    if (c.localName === name) return c;
  }
  return null;
}

/** Parse a dimension string like "210pt" or "297" — returns numeric pt value */
function parseDim(v: string | null, fallback: number): number {
  if (!v) return fallback;
  const m = v.match(/^(-?\d+(?:\.\d+)?)\s*(pt|mm|cm|in|px)?$/);
  if (!m) return fallback;
  const num = parseFloat(m[1]);
  const unit = m[2] || 'pt';
  switch (unit) {
    case 'pt': return num;
    case 'mm': return num * 2.83464567;
    case 'cm': return num * 28.3464567;
    case 'in': return num * 72;
    case 'px': return num * 0.75;
    default: return num;
  }
}
