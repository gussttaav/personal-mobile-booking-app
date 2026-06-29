import { deriveLocale } from '../i18n/device-locale';
import { translate } from '../i18n/strings';

// device-locale and strings are pure (no secure-store / RN imports), so they can
// be exercised directly without native mocks.

describe('deriveLocale', () => {
  it('maps any Spanish region tag to es', () => {
    expect(deriveLocale('es-ES')).toBe('es');
    expect(deriveLocale('es-MX')).toBe('es');
    expect(deriveLocale('ES')).toBe('es');
  });

  it('maps English to en', () => {
    expect(deriveLocale('en-US')).toBe('en');
    expect(deriveLocale('en-GB')).toBe('en');
  });

  it('falls back to en for any other language', () => {
    expect(deriveLocale('fr-FR')).toBe('en');
    expect(deriveLocale('de')).toBe('en');
    expect(deriveLocale('')).toBe('en');
  });
});

describe('translate', () => {
  it('resolves a dotted key in the requested language', () => {
    expect(translate('es', 'tabs.home')).toBe('Inicio');
    expect(translate('en', 'tabs.home')).toBe('Home');
    expect(translate('es', 'home.empty.title')).toBe('Aún no tienes clases');
  });

  it('returns the key itself when the path is missing', () => {
    // @ts-expect-error — deliberately probing an unknown key for the fallback path
    expect(translate('es', 'home.empty.nope')).toBe('home.empty.nope');
  });
});
