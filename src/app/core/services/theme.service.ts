import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';

export type AppTheme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storageKey = 'service-hub-theme';
  private currentTheme: AppTheme;

  constructor(
    @Inject(DOCUMENT) private document: Document,
    @Inject(PLATFORM_ID) private platformId: object
  ) {
    this.currentTheme = this.readTheme();
    this.applyTheme();
  }

  get theme(): AppTheme {
    return this.currentTheme;
  }

  toggle(): void {
    this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.applyTheme();
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      window.localStorage.setItem(this.storageKey, this.currentTheme);
    } catch {
      // The theme still applies for this session when storage is unavailable.
    }
  }

  private readTheme(): AppTheme {
    if (!isPlatformBrowser(this.platformId)) return 'light';
    try {
      return window.localStorage.getItem(this.storageKey) === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  }

  private applyTheme(): void {
    this.document.documentElement.setAttribute('data-theme', this.currentTheme);
  }
}
