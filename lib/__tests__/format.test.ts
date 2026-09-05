import { formatValidity, formatValidityCompact, leadTimeLabel } from '../format';
import { translate, type TranslationKey } from '../i18n/strings';
import type { Locale } from '../../types/api';

const tFor = (locale: Locale) => (key: TranslationKey) => translate(locale, key);

describe('formatValidityCompact', () => {
  it('shows whole 30-day months as "N m"', () => {
    expect(formatValidityCompact(180)).toBe('6 m'); // backend default
    expect(formatValidityCompact(30)).toBe('1 m');
    expect(formatValidityCompact(360)).toBe('12 m');
  });

  it('falls back to exact days when not a whole number of 30-day months', () => {
    expect(formatValidityCompact(200)).toBe('200 d');
    expect(formatValidityCompact(1)).toBe('1 d');
    expect(formatValidityCompact(365)).toBe('365 d');
  });

  it('treats a non-positive count as days (defensive)', () => {
    expect(formatValidityCompact(0)).toBe('0 d');
  });
});

describe('formatValidity', () => {
  const es = tFor('es');
  const en = tFor('en');

  it('pluralizes months in both locales', () => {
    expect(formatValidity(180, es)).toBe('6 meses');
    expect(formatValidity(180, en)).toBe('6 months');
    expect(formatValidity(30, es)).toBe('1 mes');
    expect(formatValidity(30, en)).toBe('1 month');
  });

  it('pluralizes the day fallback in both locales', () => {
    expect(formatValidity(200, es)).toBe('200 días');
    expect(formatValidity(200, en)).toBe('200 days');
    expect(formatValidity(1, es)).toBe('1 día');
    expect(formatValidity(1, en)).toBe('1 day');
  });
});

describe('leadTimeLabel', () => {
  it('renders the three offered lead times', () => {
    expect(leadTimeLabel(30)).toBe('30 min');
    expect(leadTimeLabel(60)).toBe('1 h');
    expect(leadTimeLabel(1440)).toBe('1 d'); // a full day
  });

  it('prefers the largest fitting unit', () => {
    expect(leadTimeLabel(120)).toBe('2 h');
    expect(leadTimeLabel(2880)).toBe('2 d');
    expect(leadTimeLabel(45)).toBe('45 min');
  });
});
