import { Injectable, signal } from '@angular/core';

export interface Toast { id: number; text: string; kind: 'info' | 'success' | 'error'; }

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private counter = 0;

  push(text: string, kind: 'info'|'success'|'error' = 'info', duration = 2500) {
    const id = ++this.counter;
    this.toasts.update(list => [...list, { id, text, kind }]);
    setTimeout(() => {
      this.toasts.update(list => list.filter(t => t.id !== id));
    }, duration);
  }
}
