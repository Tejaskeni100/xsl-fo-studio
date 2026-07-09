import { Component, ElementRef, HostListener, inject, ViewChild, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EditorStore } from '../editor.store';
import { CanvasElement, TextElement, ImageElement, PX_PER_PT } from '../models';

@Component({
  selector: 'app-canvas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './canvas.component.html',
  styleUrls: ['./canvas.component.scss'],
})
export class CanvasComponent {
  store = inject(EditorStore);
  PX_PER_PT = PX_PER_PT;
  Math = Math;

  @ViewChild('scroller', { static: true }) scroller!: ElementRef<HTMLDivElement>;

  // interaction state
  private drag: {
    id: string;
    startX: number; startY: number;
    origX: number; origY: number;
  } | null = null;

  private resize: {
    id: string;
    handle: string;
    startX: number; startY: number;
    origX: number; origY: number;
    origW: number; origH: number;
  } | null = null;

  editingId: string | null = null;
  editingText = '';

  page = computed(() => this.store.activePage());
  state = this.store.state;

  get pxWidth() { return this.state().widthPt * PX_PER_PT; }
  get pxHeight() { return this.state().heightPt * PX_PER_PT; }
  get zoom() { return this.state().zoom; }

  onCanvasClick(ev: MouseEvent) {
    if ((ev.target as HTMLElement).closest('.canvas-element')) return;
    this.store.select(null);
    this.stopEditing();
  }

  selectElement(ev: MouseEvent, id: string) {
    ev.stopPropagation();
    this.store.select(id);
  }

  onElementMouseDown(ev: MouseEvent, el: CanvasElement) {
    if (this.editingId === el.id) return;
    ev.preventDefault();
    ev.stopPropagation();
    this.store.select(el.id);
    this.drag = {
      id: el.id,
      startX: ev.clientX,
      startY: ev.clientY,
      origX: el.xPt,
      origY: el.yPt,
    };
  }

  onHandleMouseDown(ev: MouseEvent, el: CanvasElement, handle: string) {
    ev.preventDefault();
    ev.stopPropagation();
    this.resize = {
      id: el.id,
      handle,
      startX: ev.clientX,
      startY: ev.clientY,
      origX: el.xPt,
      origY: el.yPt,
      origW: el.widthPt,
      origH: el.heightPt,
    };
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(ev: MouseEvent) {
    const zoom = this.state().zoom;
    if (this.drag) {
      const dx = (ev.clientX - this.drag.startX) / (PX_PER_PT * zoom);
      const dy = (ev.clientY - this.drag.startY) / (PX_PER_PT * zoom);
      this.store.updateElement(this.drag.id, {
        xPt: Math.max(0, this.drag.origX + dx),
        yPt: Math.max(0, this.drag.origY + dy),
      }, false);
    } else if (this.resize) {
      const dx = (ev.clientX - this.resize.startX) / (PX_PER_PT * zoom);
      const dy = (ev.clientY - this.resize.startY) / (PX_PER_PT * zoom);
      const patch: any = {};
      const min = 10;
      if (this.resize.handle.includes('e')) patch.widthPt = Math.max(min, this.resize.origW + dx);
      if (this.resize.handle.includes('s')) patch.heightPt = Math.max(min, this.resize.origH + dy);
      if (this.resize.handle.includes('w')) {
        const w = Math.max(min, this.resize.origW - dx);
        patch.widthPt = w;
        patch.xPt = this.resize.origX + (this.resize.origW - w);
      }
      if (this.resize.handle.includes('n')) {
        const h = Math.max(min, this.resize.origH - dy);
        patch.heightPt = h;
        patch.yPt = this.resize.origY + (this.resize.origH - h);
      }
      this.store.updateElement(this.resize.id, patch, false);
    }
  }

  @HostListener('window:mouseup')
  onMouseUp() {
    // commit action -> record a snapshot by touching state again
    if (this.drag || this.resize) {
      const id = this.drag?.id ?? this.resize?.id;
      if (id) {
        const el = this.currentElement(id);
        if (el) this.store.updateElement(id, { xPt: el.xPt, yPt: el.yPt, widthPt: el.widthPt, heightPt: el.heightPt }, true);
      }
    }
    this.drag = null;
    this.resize = null;
  }

  private currentElement(id: string): CanvasElement | undefined {
    return this.store.activePage().elements.find(e => e.id === id);
  }

  beginEditText(el: TextElement, ev: MouseEvent) {
    ev.stopPropagation();
    if (el.isDynamic) return;
    this.editingId = el.id;
    this.editingText = el.content;
    setTimeout(() => {
      const ta = document.querySelector<HTMLTextAreaElement>('.inline-edit');
      ta?.focus();
      ta?.select();
    }, 0);
  }

  stopEditing() {
    if (this.editingId) {
      this.store.updateElement(this.editingId, { content: this.editingText } as Partial<TextElement>);
    }
    this.editingId = null;
    this.editingText = '';
  }

  asText(el: CanvasElement): TextElement { return el as TextElement; }
  asImage(el: CanvasElement): ImageElement { return el as ImageElement; }

  isSelected(id: string) { return this.state().selectedElementId === id; }

  trackById(_i: number, el: CanvasElement) { return el.id; }
}
