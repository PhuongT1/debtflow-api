import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AppLocale, DEFAULT_LOCALE, parseAcceptLanguage, SUPPORTED_LOCALES } from './i18n.types.js';
import { enTranslations } from './locales/en.js';
import { viTranslations } from './locales/vi.js';

const translations: Record<AppLocale, typeof viTranslations> = {
  vi: viTranslations,
  en: enTranslations,
};

@Injectable()
export class I18nService {
  /**
   * Resolves the locale from an incoming Express Request via Accept-Language header.
   */
  resolveLocale(request?: Request | null): AppLocale {
    if (!request) return DEFAULT_LOCALE;
    const header = request.headers?.['accept-language'];
    return parseAcceptLanguage(
      typeof header === 'string' ? header : Array.isArray(header) ? header[0] : null,
    );
  }

  /**
   * Translates a key by dot notation, e.g. "auth.INVALID_CREDENTIALS", "errors.RESOURCE_NOT_FOUND".
   * Fallback to Vietnamese dictionary, then fallback to the key itself or default message if not found.
   */
  translate(
    key: string,
    locale: AppLocale = DEFAULT_LOCALE,
    params?: Record<string, string | number>,
  ): string {
    const targetLocale = SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
    const dict = translations[targetLocale] ?? translations[DEFAULT_LOCALE];

    let result = this.lookup(dict, key);
    if (!result && targetLocale !== DEFAULT_LOCALE) {
      result = this.lookup(translations[DEFAULT_LOCALE], key);
    }

    if (!result) {
      return key;
    }

    if (params && Object.keys(params).length > 0) {
      return Object.entries(params).reduce(
        (acc, [paramKey, paramVal]) =>
          acc.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal)),
        result,
      );
    }

    return result;
  }

  /**
   * Shorthand alias for translate
   */
  t(
    key: string,
    locale: AppLocale = DEFAULT_LOCALE,
    params?: Record<string, string | number>,
  ): string {
    return this.translate(key, locale, params);
  }

  private lookup(obj: object, path: string): string | undefined {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return typeof current === 'string' ? current : undefined;
  }
}
