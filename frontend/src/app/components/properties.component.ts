import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EditorStore } from '../editor.store';
import { CanvasElement, TextElement, ImageElement, FONT_FAMILIES } from '../models';

@Component({
  selector: 'app-properties',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './properties.component.html',
  styleUrls: ['./properties.component.scss'],
})
export class PropertiesComponent {
  store = inject(EditorStore);
  fonts = FONT_FAMILIES;

  selected = this.store.selectedElement;

  asText(e: CanvasElement): TextElement { return e as TextElement; }
  asImage(e: CanvasElement): ImageElement { return e as ImageElement; }

  update<K extends keyof CanvasElement>(patch: Partial<CanvasElement>) {
    const s = this.selected();
    if (!s) return;
    this.store.updateElement(s.id, patch);
  }

  remove() {
    const s = this.selected();
    if (s) this.store.removeElement(s.id);
  }

  duplicate() {
    const s = this.selected();
    if (s) this.store.duplicateElement(s.id);
  }
}
