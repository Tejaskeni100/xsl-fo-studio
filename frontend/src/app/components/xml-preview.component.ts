import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  inject,
  effect,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditorStore } from '../editor.store';
import { XslFoGenerator } from '../xsl-fo-generator.service';
import { XslFoParser } from '../xsl-fo-parser.service';
import { ToastService } from '../toast.service';
import * as monaco from 'monaco-editor';

@Component({
  selector: 'app-xml-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './xml-preview.component.html',
  styleUrls: ['./xml-preview.component.scss'],
})
export class XmlPreviewComponent implements AfterViewInit, OnDestroy {
  store = inject(EditorStore);
  gen = inject(XslFoGenerator);
  parser = inject(XslFoParser);
  toast = inject(ToastService);

  @ViewChild('editorHost', { static: true })
  editorHost!: ElementRef<HTMLDivElement>;
  @ViewChild('panelRef', { static: true }) panelRef!: ElementRef<HTMLElement>;
  private editor: monaco.editor.IStandaloneCodeEditor | null = null;

  collapsed = false;
  editable = false;
  isDirty = false;
  wrapText = false;
  currentXml = '';
  panelWidth = 440;
  panelLeft = 0;
  panelTop = 0;
  isDragged = false;
  private ignoreNextChange = false;
  private isDragging = false;
  private isResizing = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private startLeft = 0;
  private startTop = 0;
  private resizeStartX = 0;
  private startWidth = 440;

  constructor() {
    effect(() => {
      const s = this.store.state();
      const nextXml = this.gen.generate(s);
      // Only overwrite editor content when not in editable mode OR user hasn't modified
      if (!this.editable || !this.isDirty) {
        this.currentXml = nextXml;
        if (this.editor) {
          const cur = this.editor.getValue();
          if (cur !== nextXml) {
            this.ignoreNextChange = true;
            this.editor.setValue(nextXml);
          }
        }
      }
    });
  }

  ngAfterViewInit() {
    (self as any).MonacoEnvironment = {
      getWorker: () => ({
        postMessage: () => {},
        terminate: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    };
    this.editor = monaco.editor.create(this.editorHost.nativeElement, {
      value: this.currentXml,
      language: 'xml',
      theme: 'vs-dark',
      readOnly: !this.editable,
      automaticLayout: true,
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 12,
      lineNumbers: 'on',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'off',
      renderLineHighlight: 'none',
      overviewRulerLanes: 0,
      folding: true,
      padding: { top: 12, bottom: 12 },
    });

    setTimeout(() => this.refreshEditorLayout(), 0);

    this.editor.onDidChangeModelContent(() => {
      if (this.ignoreNextChange) {
        this.ignoreNextChange = false;
        return;
      }
      if (!this.editable) return;
      this.isDirty = true;
    });
  }

  ngOnDestroy() {
    this.stopInteraction();
    this.editor?.dispose();
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (this.isDragging) {
      event.preventDefault();
      const deltaX = event.clientX - this.dragStartX;
      const deltaY = event.clientY - this.dragStartY;
      this.panelLeft = Math.max(0, this.startLeft + deltaX);
      this.panelTop = Math.max(0, this.startTop + deltaY);
    }

    if (this.isResizing) {
      event.preventDefault();
      const deltaX = event.clientX - this.resizeStartX;
      const nextWidth = this.startWidth - deltaX;
      this.panelWidth = Math.min(720, Math.max(280, nextWidth));
      this.refreshEditorLayout();
    }
  }

  @HostListener('window:mouseup')
  onMouseUp() {
    this.stopInteraction();
    this.refreshEditorLayout();
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.refreshEditorLayout();
  }

  startDrag(event: MouseEvent) {
    if ((event.target as HTMLElement)?.closest('button')) return;
    const rect = this.panelRef.nativeElement.getBoundingClientRect();
    this.isDragged = true;
    this.isDragging = true;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.startLeft = rect.left;
    this.startTop = rect.top;
    document.body.style.userSelect = 'none';
  }

  startResize(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isResizing = true;
    this.resizeStartX = event.clientX;
    this.startWidth = this.panelWidth;
    document.body.style.userSelect = 'none';
  }

  private stopInteraction() {
    this.isDragging = false;
    this.isResizing = false;
    document.body.style.userSelect = '';
  }

  private refreshEditorLayout() {
    requestAnimationFrame(() => this.editor?.layout());
  }

  toggleEditable() {
    this.editable = !this.editable;
    this.editor?.updateOptions({ readOnly: !this.editable });
    this.refreshEditorLayout();
    if (!this.editable && this.isDirty) {
      // Discard by resyncing from state
      this.isDirty = false;
      const xml = this.gen.generate(this.store.state());
      this.ignoreNextChange = true;
      this.editor?.setValue(xml);
    }
  }

  applyChanges() {
    if (!this.editor) return;
    const xml = this.editor.getValue();
    try {
      const next = this.parser.parse(xml, this.store.state());
      this.store.replaceState(next);
      this.isDirty = false;
      this.toast.push('XML applied to canvas', 'success');
    } catch (err: any) {
      this.toast.push(
        'Parse failed: ' + (err?.message || 'Invalid XSL-FO'),
        'error',
      );
    }
  }

  resetChanges() {
    if (!this.editor) return;
    const xml = this.gen.generate(this.store.state());
    this.ignoreNextChange = true;
    this.editor.setValue(xml);
    this.isDirty = false;
    this.toast.push('Reverted to canvas state', 'info');
  }

  async copyXml() {
    const xml = this.editor?.getValue() ?? this.currentXml;
    try {
      await navigator.clipboard.writeText(xml);
      this.toast.push('XML copied to clipboard', 'success');
    } catch {
      this.toast.push('Copy failed — select text manually', 'error');
    }
  }

  downloadXsl() {
    const xml = this.editor?.getValue() ?? this.currentXml;
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template.xsl';
    a.click();
    URL.revokeObjectURL(url);
    this.toast.push('Downloaded template.xsl', 'success');
  }

  onPasteFile(input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (!this.editor) return;
      this.editable = true;
      this.editor.updateOptions({ readOnly: false });
      this.ignoreNextChange = true;
      this.editor.setValue(reader.result as string);
      this.isDirty = true;
      this.toast.push('XML loaded — click "Apply" to render', 'info');
      input.value = '';
    };
    reader.readAsText(file);
  }

  get lineCount() {
    return (this.editor?.getValue() ?? this.currentXml).split('\n').length;
  }
  get byteSize() {
    return new Blob([this.editor?.getValue() ?? this.currentXml]).size;
  }

  toggleWrapText() {
    this.wrapText = !this.wrapText;
    this.editor?.updateOptions({ wordWrap: this.wrapText ? 'on' : 'off' });
    this.refreshEditorLayout();
  }

  toggleCollapse() {
    this.collapsed = !this.collapsed;
    setTimeout(() => this.refreshEditorLayout(), 200);
  }
}
