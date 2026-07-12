import { Injectable, signal, computed, effect } from '@angular/core';
import {
  DocState, PageDoc, CanvasElement, TextElement, ImageElement,
  PageSizeKey, PAGE_PRESETS, Unit, ImagePathMode, CustomFont
} from './models';

const STORAGE_KEY = 'xslfo-studio:current-doc';
const TEMPLATES_KEY = 'xslfo-studio:templates';
const HISTORY_LIMIT = 60;

function uid(prefix = 'el'): string {
  return prefix + '-' + Math.random().toString(36).slice(2, 9);
}

function defaultPage(name = 'Page 1'): PageDoc {
  return {
    id: uid('page'),
    name,
    backgroundDataUrl: '',
    backgroundPlaceholder: 'backgroundImage',
    elements: [],
  };
}

function initialState(): DocState {
  const page = defaultPage();
  return {
    pageSizeKey: 'A4',
    widthPt: 595,
    heightPt: 842,
    unit: 'mm',
    imagePathMode: 'placeholder',
    pages: [page],
    activePageId: page.id,
    selectedElementId: null,
    zoom: 0.85,
    showGrid: false,
    showRulers: true,
    customFonts: [],
  };
}

@Injectable({ providedIn: 'root' })
export class EditorStore {
  readonly state = signal<DocState>(initialState());

  // history stacks (serialized snapshots without transient fields)
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private suspendHistory = false;

  readonly activePage = computed<PageDoc>(() => {
    const s = this.state();
    return s.pages.find(p => p.id === s.activePageId) ?? s.pages[0];
  });

  readonly selectedElement = computed<CanvasElement | null>(() => {
    const s = this.state();
    if (!s.selectedElementId) return null;
    for (const p of s.pages) {
      const e = p.elements.find(el => el.id === s.selectedElementId);
      if (e) return e;
    }
    return null;
  });

  readonly canUndo = signal(false);
  readonly canRedo = signal(false);

  constructor() {
    // Autosave current doc to localStorage
    effect(() => {
      const s = this.state();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.serializable(s)));
      } catch {}
    });
    // Try restore
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as DocState;
        if (parsed && parsed.pages && parsed.pages.length) {
          this.state.set({ ...initialState(), ...parsed, customFonts: parsed.customFonts ?? [], selectedElementId: null });
        }
      } catch {}
    }
    this.pushHistorySnapshot(); // initial baseline
  }

  private serializable(s: DocState): DocState {
    return { ...s, selectedElementId: null };
  }

  /* ---------- HISTORY ---------- */
  private pushHistorySnapshot() {
    if (this.suspendHistory) return;
    const snap = JSON.stringify(this.serializable(this.state()));
    if (this.undoStack[this.undoStack.length - 1] === snap) return;
    this.undoStack.push(snap);
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    this.redoStack = [];
    this.canUndo.set(this.undoStack.length > 1);
    this.canRedo.set(false);
  }

  private mutate(fn: (s: DocState) => DocState, recordHistory = true) {
    if (recordHistory && !this.suspendHistory) {
      // snapshot current (pre-change) once
      const snap = JSON.stringify(this.serializable(this.state()));
      if (this.undoStack[this.undoStack.length - 1] !== snap) {
        this.undoStack.push(snap);
        if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
      }
      this.redoStack = [];
    }
    this.state.update(fn);
    this.canUndo.set(this.undoStack.length > 0);
    this.canRedo.set(this.redoStack.length > 0);
  }

  undo() {
    if (this.undoStack.length === 0) return;
    const current = JSON.stringify(this.serializable(this.state()));
    const prev = this.undoStack.pop()!;
    this.redoStack.push(current);
    this.suspendHistory = true;
    this.state.set(JSON.parse(prev));
    this.suspendHistory = false;
    this.canUndo.set(this.undoStack.length > 0);
    this.canRedo.set(this.redoStack.length > 0);
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const current = JSON.stringify(this.serializable(this.state()));
    const next = this.redoStack.pop()!;
    this.undoStack.push(current);
    this.suspendHistory = true;
    this.state.set(JSON.parse(next));
    this.suspendHistory = false;
    this.canUndo.set(this.undoStack.length > 0);
    this.canRedo.set(this.redoStack.length > 0);
  }

  /* ---------- PAGE ---------- */
  setPageSize(key: PageSizeKey, widthPt?: number, heightPt?: number) {
    this.mutate(s => {
      if (key === 'Custom') {
        return { ...s, pageSizeKey: key, widthPt: widthPt ?? s.widthPt, heightPt: heightPt ?? s.heightPt };
      }
      const preset = PAGE_PRESETS.find(p => p.key === key)!;
      return { ...s, pageSizeKey: key, widthPt: preset.widthPt, heightPt: preset.heightPt };
    });
  }

  setUnit(unit: Unit) { this.mutate(s => ({ ...s, unit }), false); }
  setImagePathMode(mode: ImagePathMode) { this.mutate(s => ({ ...s, imagePathMode: mode })); }
  setZoom(zoom: number) { this.mutate(s => ({ ...s, zoom: Math.max(0.2, Math.min(3, zoom)) }), false); }
  toggleGrid() { this.mutate(s => ({ ...s, showGrid: !s.showGrid }), false); }
  toggleRulers() { this.mutate(s => ({ ...s, showRulers: !s.showRulers }), false); }

  setBackground(dataUrl: string, placeholder?: string) {
    this.mutate(s => {
      const pages = s.pages.map(p =>
        p.id === s.activePageId
          ? { ...p, backgroundDataUrl: dataUrl, backgroundPlaceholder: placeholder ?? p.backgroundPlaceholder }
          : p
      );
      return { ...s, pages };
    });
  }

  clearBackground() {
    this.mutate(s => {
      const pages = s.pages.map(p =>
        p.id === s.activePageId ? { ...p, backgroundDataUrl: '' } : p
      );
      return { ...s, pages };
    });
  }

  setBackgroundPlaceholder(name: string) {
    this.mutate(s => ({
      ...s,
      pages: s.pages.map(p => p.id === s.activePageId ? { ...p, backgroundPlaceholder: name } : p)
    }));
  }

  addPage() {
    this.mutate(s => {
      const page = { ...defaultPage(`Page ${s.pages.length + 1}`) };
      return { ...s, pages: [...s.pages, page], activePageId: page.id, selectedElementId: null };
    });
  }

  removePage(id: string) {
    this.mutate(s => {
      if (s.pages.length <= 1) return s;
      const pages = s.pages.filter(p => p.id !== id);
      const activePageId = s.activePageId === id ? pages[0].id : s.activePageId;
      return { ...s, pages, activePageId, selectedElementId: null };
    });
  }

  setActivePage(id: string) { this.mutate(s => ({ ...s, activePageId: id, selectedElementId: null }), false); }

  /* ---------- CUSTOM FONTS ---------- */
  addCustomFont(font: CustomFont) {
    this.mutate(s => ({ ...s, customFonts: [...s.customFonts, font] }));
  }

  removeCustomFont(id: string) {
    this.mutate(s => ({ ...s, customFonts: s.customFonts.filter(f => f.id !== id) }));
  }

  replaceState(next: DocState) {
    this.mutate(() => ({ ...next, selectedElementId: null }));
  }

  /* ---------- ELEMENTS ---------- */
  addText() {
    const el: TextElement = {
      id: uid('txt'),
      type: 'text',
      xPt: 60, yPt: 60, widthPt: 200, heightPt: 40,
      content: 'Text Block',
      isDynamic: false,
      dynamicField: 'fieldName',
      fontFamily: 'Helvetica',
      fontSize: 14,
      fontWeight: 'normal',
      fontStyle: 'normal',
      color: '#111111',
      align: 'left',
    };
    this.addElement(el);
  }

  addImage(dataUrl: string, filename: string) {
    const el: ImageElement = {
      id: uid('img'),
      type: 'image',
      xPt: 80, yPt: 80, widthPt: 120, heightPt: 120,
      dataUrl,
      placeholderName: 'userImage',
      filename,
      scaling: 'uniform',
    };
    this.addElement(el);
  }

  private addElement(el: CanvasElement) {
    this.mutate(s => {
      const pages = s.pages.map(p =>
        p.id === s.activePageId ? { ...p, elements: [...p.elements, el] } : p
      );
      return { ...s, pages, selectedElementId: el.id };
    });
  }

  updateElement(id: string, patch: Partial<CanvasElement>, recordHistory = true) {
    this.mutate(s => {
      const pages = s.pages.map(p => {
        if (p.id !== s.activePageId) return p;
        return {
          ...p,
          elements: p.elements.map(e => e.id === id ? ({ ...e, ...patch } as CanvasElement) : e),
        };
      });
      return { ...s, pages };
    }, recordHistory);
  }

  removeElement(id: string) {
    this.mutate(s => {
      const pages = s.pages.map(p => ({ ...p, elements: p.elements.filter(e => e.id !== id) }));
      return { ...s, pages, selectedElementId: null };
    });
  }

  duplicateElement(id: string) {
    const cur = this.selectedElement();
    if (!cur || cur.id !== id) return;
    const copy = { ...cur, id: uid(cur.type === 'text' ? 'txt' : 'img'), xPt: cur.xPt + 10, yPt: cur.yPt + 10 };
    this.addElement(copy as CanvasElement);
  }

  select(id: string | null) { this.mutate(s => ({ ...s, selectedElementId: id }), false); }

  /* ---------- TEMPLATES ---------- */
  listTemplates(): { id: string; name: string; savedAt: string }[] {
    try {
      const raw = localStorage.getItem(TEMPLATES_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return arr.map((t: any) => ({ id: t.id, name: t.name, savedAt: t.savedAt }));
    } catch { return []; }
  }

  saveTemplate(name: string) {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    const arr: any[] = raw ? JSON.parse(raw) : [];
    const entry = {
      id: uid('tpl'),
      name,
      savedAt: new Date().toISOString(),
      state: this.serializable(this.state()),
    };
    arr.push(entry);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(arr));
    return entry.id;
  }

  loadTemplate(id: string) {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    if (!raw) return;
    const arr: any[] = JSON.parse(raw);
    const t = arr.find(x => x.id === id);
    if (!t) return;
    this.mutate(() => ({ ...t.state, selectedElementId: null }));
  }

  deleteTemplate(id: string) {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    if (!raw) return;
    const arr: any[] = JSON.parse(raw);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(arr.filter(x => x.id !== id)));
  }

  exportJSON(): string {
    return JSON.stringify(this.serializable(this.state()), null, 2);
  }

  importJSON(json: string) {
    const parsed = JSON.parse(json) as DocState;
    this.mutate(() => ({ ...initialState(), ...parsed, selectedElementId: null }));
  }

  newDocument() {
    this.mutate(() => initialState());
  }
}
