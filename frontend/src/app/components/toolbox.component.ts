import { Component, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EditorStore } from '../editor.store';
import { PAGE_PRESETS, PageSizeKey, Unit, toPt, fromPt, ImagePathMode } from '../models';
import { ToastService } from '../toast.service';

@Component({
  selector: 'app-toolbox',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './toolbox.component.html',
  styleUrls: ['./toolbox.component.scss'],
})
export class ToolboxComponent {
  store = inject(EditorStore);
  toast = inject(ToastService);
  presets = PAGE_PRESETS;
  units: Unit[] = ['pt', 'mm', 'cm', 'in'];
  modes: { key: ImagePathMode; label: string; hint: string }[] = [
    { key: 'placeholder', label: 'Placeholder', hint: '{userImage}' },
    { key: 'file', label: 'File path', hint: 'file:///…' },
    { key: 'base64', label: 'Base64', hint: 'data:image/…' },
  ];

  templatesOpen = false;
  templateName = '';

  @ViewChild('bgFile') bgFile!: ElementRef<HTMLInputElement>;
  @ViewChild('imgFile') imgFile!: ElementRef<HTMLInputElement>;
  @ViewChild('importFile') importFile!: ElementRef<HTMLInputElement>;

  state = this.store.state;

  get widthInUnit() {
    const s = this.state();
    return round2(fromPt(s.widthPt, s.unit));
  }
  set widthInUnit(val: number) {
    const s = this.state();
    this.store.setPageSize('Custom', toPt(val, s.unit), s.heightPt);
  }
  get heightInUnit() {
    const s = this.state();
    return round2(fromPt(s.heightPt, s.unit));
  }
  set heightInUnit(val: number) {
    const s = this.state();
    this.store.setPageSize('Custom', s.widthPt, toPt(val, s.unit));
  }

  onPreset(key: PageSizeKey) { this.store.setPageSize(key); }

  onUpload(input: HTMLInputElement, target: 'bg' | 'img') {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (target === 'bg') {
        this.store.setBackground(dataUrl);
        this.toast.push('Background image uploaded', 'success');
      } else {
        this.store.addImage(dataUrl, file.name);
        this.toast.push('Image block added', 'success');
      }
      input.value = '';
    };
    reader.readAsDataURL(file);
  }

  addText() {
    this.store.addText();
    this.toast.push('Text block added', 'success');
  }

  askAddImage() {
    const ok = confirm('Add an image overlay block on the canvas?\nYou will be prompted to select an image file.');
    if (ok) this.imgFile.nativeElement.click();
  }

  clearBackground() {
    this.store.clearBackground();
    this.toast.push('Background cleared', 'info');
  }

  saveTemplate() {
    const name = (this.templateName || '').trim() || `Template ${new Date().toLocaleString()}`;
    this.store.saveTemplate(name);
    this.templateName = '';
    this.toast.push(`Saved "${name}"`, 'success');
  }

  loadTemplate(id: string) {
    this.store.loadTemplate(id);
    this.toast.push('Template loaded', 'success');
  }

  deleteTemplate(id: string, ev: Event) {
    ev.stopPropagation();
    this.store.deleteTemplate(id);
    this.toast.push('Template deleted', 'info');
  }

  templates() { return this.store.listTemplates(); }

  exportJSON() {
    const blob = new Blob([this.store.exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'xslfo-template.json';
    a.click();
    URL.revokeObjectURL(url);
    this.toast.push('Template JSON exported', 'success');
  }

  importJSON(input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        this.store.importJSON(reader.result as string);
        this.toast.push('Template imported', 'success');
      } catch {
        this.toast.push('Invalid JSON file', 'error');
      }
      input.value = '';
    };
    reader.readAsText(file);
  }

  onImagePathMode(mode: ImagePathMode) {
    this.store.setImagePathMode(mode);
  }

  newDoc() {
    if (confirm('Start a new document? Unsaved changes will be lost.')) {
      this.store.newDocument();
    }
  }
}

function round2(n: number) { return Math.round(n * 100) / 100; }
