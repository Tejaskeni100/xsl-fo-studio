import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditorStore } from '../editor.store';
import { XslFoGenerator } from '../xsl-fo-generator.service';
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
  toast = inject(ToastService);

  @ViewChild('editorHost', { static: true }) editorHost!: ElementRef<HTMLDivElement>;
  private editor: monaco.editor.IStandaloneCodeEditor | null = null;

  collapsed = false;
  currentXml = '';

  constructor() {
    // Reactively regenerate XML when state changes
    effect(() => {
      const s = this.store.state();
      this.currentXml = this.gen.generate(s);
      if (this.editor) {
        const cur = this.editor.getValue();
        if (cur !== this.currentXml) this.editor.setValue(this.currentXml);
      }
    });
  }

  ngAfterViewInit() {
    // Ensure Monaco has a global for AMD-free mode
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
      readOnly: true,
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
  }

  ngOnDestroy() {
    this.editor?.dispose();
  }

  async copyXml() {
    try {
      await navigator.clipboard.writeText(this.currentXml);
      this.toast.push('XML copied to clipboard', 'success');
    } catch {
      this.toast.push('Copy failed — select text manually', 'error');
    }
  }

  downloadXsl() {
    const blob = new Blob([this.currentXml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template.xsl';
    a.click();
    URL.revokeObjectURL(url);
    this.toast.push('Downloaded template.xsl', 'success');
  }

  get lineCount() { return this.currentXml.split('\n').length; }
  get byteSize() { return new Blob([this.currentXml]).size; }

  toggleCollapse() {
    this.collapsed = !this.collapsed;
    setTimeout(() => this.editor?.layout(), 200);
  }
}
