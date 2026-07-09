import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EditorStore } from './editor.store';
import { ToastService } from './toast.service';
import { ToolboxComponent } from './components/toolbox.component';
import { PropertiesComponent } from './components/properties.component';
import { CanvasComponent } from './components/canvas.component';
import { XmlPreviewComponent } from './components/xml-preview.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, ToolboxComponent, PropertiesComponent, CanvasComponent, XmlPreviewComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  store = inject(EditorStore);
  toast = inject(ToastService);

  state = this.store.state;
  toasts = this.toast.toasts;

  zoomIn() { this.store.setZoom(this.state().zoom + 0.1); }
  zoomOut() { this.store.setZoom(this.state().zoom - 0.1); }
  zoomReset() { this.store.setZoom(1); }
  zoomFit() { this.store.setZoom(0.85); }

  addPage() {
    this.store.addPage();
    this.toast.push('Page added', 'success');
  }
  removePage(id: string) {
    if (this.state().pages.length <= 1) {
      this.toast.push('At least one page is required', 'error');
      return;
    }
    if (confirm('Delete this page?')) this.store.removePage(id);
  }
  selectPage(id: string) { this.store.setActivePage(id); }

  @HostListener('window:keydown', ['$event'])
  onKey(ev: KeyboardEvent) {
    // Skip when typing in inputs
    const target = ev.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

    const mod = ev.metaKey || ev.ctrlKey;
    if (mod && ev.key.toLowerCase() === 'z' && !ev.shiftKey) {
      ev.preventDefault();
      this.store.undo();
    } else if ((mod && ev.key.toLowerCase() === 'y') || (mod && ev.shiftKey && ev.key.toLowerCase() === 'z')) {
      ev.preventDefault();
      this.store.redo();
    } else if ((ev.key === 'Delete' || ev.key === 'Backspace') && this.state().selectedElementId) {
      ev.preventDefault();
      this.store.removeElement(this.state().selectedElementId!);
    } else if (ev.key === 'Escape') {
      this.store.select(null);
    }
  }
}
