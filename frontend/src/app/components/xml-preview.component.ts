import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, inject, effect } from '@angular/core';
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

  @ViewChild('editorHost', { static: true }) editorHost!: ElementRef<HTMLDivElement>;
  private editor: monaco.editor.IStandaloneCodeEditor | null = null;

  collapsed = false;
  editable = false;
  isDirty = false;
  currentXml = '';
  private ignoreNextChange = false;

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

    this.editor.onDidChangeModelContent(() => {
      if (this.ignoreNextChange) { this.ignoreNextChange = false; return; }
      if (!this.editable) return;
      this.isDirty = true;
    });
  }

  ngOnDestroy() { this.editor?.dispose(); }

  toggleEditable() {
    this.editable = !this.editable;
    this.editor?.updateOptions({ readOnly: !this.editable });
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
      this.toast.push('Parse failed: ' + (err?.message || 'Invalid XSL-FO'), 'error');
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

  get lineCount() { return (this.editor?.getValue() ?? this.currentXml).split('\n').length; }
  get byteSize() { return new Blob([this.editor?.getValue() ?? this.currentXml]).size; }

  toggleCollapse() {
    this.collapsed = !this.collapsed;
    setTimeout(() => this.editor?.layout(), 200);
  }
}
