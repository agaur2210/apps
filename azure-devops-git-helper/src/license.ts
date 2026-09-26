// License validation for Pro (AI) features.
// Format: GHADO-XXXX-XXXX-XXXX  (uppercase alphanumeric segments)
//
// __AUTHOR_KEY__ is injected at build time from .author-key (gitignored).

const LICENSE_PATTERN = /^GHADO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

function isAuthorKey(key: string): boolean {
  return __AUTHOR_KEY__ !== '' && key === __AUTHOR_KEY__;
}

export function isLicensed(key: string): boolean {
  const k = key.trim().toUpperCase();
  return isAuthorKey(k) || LICENSE_PATTERN.test(k);
}

export function licenseStatus(key: string): 'author' | 'licensed' | 'unlicensed' {
  const k = key.trim().toUpperCase();
  if (isAuthorKey(k)) return 'author';
  if (LICENSE_PATTERN.test(k)) return 'licensed';
  return 'unlicensed';
}
