import { Injectable, effect, inject } from '@angular/core';
import { EditorStore } from './editor.store';

/**
 * Watches DocState.customFonts and injects/removes @font-face rules
 * via a single <style id="custom-fonts"> element in <head>.
 */
@Injectable({ providedIn: 'root' })
export class CustomFontService {
  private store = inject(EditorStore);
  private styleEl: HTMLStyleElement | null = null;

  constructor() {
    effect(() => {
      const fonts = this.store.state().customFonts;
      this.renderFontFaces(fonts);
    });
  }

  private renderFontFaces(fonts: { name: string; dataUrl: string; format: string }[]) {
    if (typeof document === 'undefined') return;
    if (!this.styleEl) {
      this.styleEl = document.createElement('style');
      this.styleEl.id = 'xslfo-custom-fonts';
      document.head.appendChild(this.styleEl);
    }
    const rules = fonts.map(f =>
      `@font-face { font-family: "${escapeCss(f.name)}"; src: url("${f.dataUrl}") format("${f.format}"); font-display: swap; }`
    ).join('\n');
    this.styleEl.textContent = rules;
  }
}

function escapeCss(s: string): string {
  return s.replace(/"/g, '\\"');
}
