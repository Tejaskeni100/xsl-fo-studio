import { Injectable } from '@angular/core';
import { DocState, PageDoc, CanvasElement, TextElement, ImageElement, ImagePathMode } from './models';

/**
 * Generates XSL-FO 1.0 XML output from the current editor state.
 * All positions are stored in points (pt) — the native XSL-FO unit.
 */
@Injectable({ providedIn: 'root' })
export class XslFoGenerator {

  generate(state: DocState): string {
    const lines: string[] = [];
    lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
    lines.push(`<fo:root xmlns:fo="http://www.w3.org/1999/XSL/Format" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">`);

    // Layout master set — one page master per page (to allow future distinct sizes)
    lines.push(`  <fo:layout-master-set>`);
    state.pages.forEach((p, idx) => {
      const masterName = `page-master-${idx + 1}`;
      lines.push(`    <fo:simple-page-master master-name="${masterName}" page-width="${fmt(state.widthPt)}pt" page-height="${fmt(state.heightPt)}pt" margin="0pt">`);
      lines.push(`      <fo:region-body region-name="body-${idx + 1}" margin="0pt"/>`);
      lines.push(`    </fo:simple-page-master>`);
    });
    lines.push(`  </fo:layout-master-set>`);

    // Page sequences
    state.pages.forEach((page, idx) => {
      const masterName = `page-master-${idx + 1}`;
      lines.push(`  <fo:page-sequence master-reference="${masterName}">`);
      lines.push(`    <fo:flow flow-name="body-${idx + 1}">`);
      lines.push(`      <fo:block-container absolute-position="absolute" top="0pt" left="0pt" width="${fmt(state.widthPt)}pt" height="${fmt(state.heightPt)}pt">`);

      // Background image (if present)
      if (page.backgroundDataUrl || page.backgroundPlaceholder) {
        const src = this.imageSrc(page.backgroundDataUrl, page.backgroundPlaceholder, state.imagePathMode);
        lines.push(`        <!-- Background -->`);
        lines.push(`        <fo:block-container absolute-position="absolute" top="0pt" left="0pt" width="${fmt(state.widthPt)}pt" height="${fmt(state.heightPt)}pt">`);
        lines.push(`          <fo:block>`);
        lines.push(`            <fo:external-graphic src="${escapeXml(src)}" content-width="${fmt(state.widthPt)}pt" content-height="${fmt(state.heightPt)}pt" scaling="non-uniform"/>`);
        lines.push(`          </fo:block>`);
        lines.push(`        </fo:block-container>`);
      }

      // Elements
      page.elements.forEach(el => {
        if (el.type === 'text') this.renderText(el, lines);
        else this.renderImage(el, state.imagePathMode, lines);
      });

      lines.push(`      </fo:block-container>`);
      lines.push(`    </fo:flow>`);
      lines.push(`  </fo:page-sequence>`);
    });

    lines.push(`</fo:root>`);
    return lines.join('\n');
  }

  private renderText(el: TextElement, lines: string[]) {
    const attrs = [
      `absolute-position="absolute"`,
      `top="${fmt(el.yPt)}pt"`,
      `left="${fmt(el.xPt)}pt"`,
      `width="${fmt(el.widthPt)}pt"`,
      `height="${fmt(el.heightPt)}pt"`,
    ].join(' ');

    const blockAttrs = [
      `font-family="${escapeXml(el.fontFamily)}"`,
      `font-size="${fmt(el.fontSize)}pt"`,
      `font-weight="${el.fontWeight}"`,
      `font-style="${el.fontStyle}"`,
      `color="${el.color}"`,
      `text-align="${el.align}"`,
    ].join(' ');

    lines.push(`        <fo:block-container ${attrs}>`);
    if (el.isDynamic) {
      const field = escapeXml(el.dynamicField || 'fieldName');
      lines.push(`          <fo:block ${blockAttrs}><xsl:value-of select="${field}"/></fo:block>`);
    } else {
      lines.push(`          <fo:block ${blockAttrs}><xsl:text>${escapeXml(el.content)}</xsl:text></fo:block>`);
    }
    lines.push(`        </fo:block-container>`);
  }

  private renderImage(el: ImageElement, mode: ImagePathMode, lines: string[]) {
    const src = this.imageSrc(el.dataUrl, el.placeholderName, mode, el.filename);
    const containerAttrs = [
      `absolute-position="absolute"`,
      `top="${fmt(el.yPt)}pt"`,
      `left="${fmt(el.xPt)}pt"`,
      `width="${fmt(el.widthPt)}pt"`,
      `height="${fmt(el.heightPt)}pt"`,
    ].join(' ');
    const imgAttrs = [
      `src="${escapeXml(src)}"`,
      `content-width="${fmt(el.widthPt)}pt"`,
      `content-height="${fmt(el.heightPt)}pt"`,
      `scaling="${el.scaling}"`,
    ].join(' ');
    lines.push(`        <fo:block-container ${containerAttrs}>`);
    lines.push(`          <fo:block><fo:external-graphic ${imgAttrs}/></fo:block>`);
    lines.push(`        </fo:block-container>`);
  }

  private imageSrc(dataUrl: string, placeholder: string, mode: ImagePathMode, filename?: string): string {
    switch (mode) {
      case 'placeholder':
        return `{${placeholder || 'image'}}`;
      case 'file':
        return `file:///path/to/${filename || placeholder || 'image.png'}`;
      case 'base64':
        return dataUrl || `{${placeholder || 'image'}}`;
    }
  }
}

function fmt(n: number): string {
  // Trim to 2 decimals, remove trailing zeros
  const s = n.toFixed(2);
  return s.replace(/\.?0+$/, '');
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
