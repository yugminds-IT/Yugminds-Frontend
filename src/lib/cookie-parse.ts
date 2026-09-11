/** Parse Set-Cookie header list from a Fetch Headers object. */
export function getSetCookies(headers: Headers): string[] {
  const withSetCookie = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof withSetCookie.getSetCookie === 'function') {
    return withSetCookie.getSetCookie();
  }
  const single = headers.get('set-cookie');
  return single ? [single] : [];
}

/** Read a cookie value from Set-Cookie header strings. */
export function cookieValue(setCookies: string[], name: string): string | undefined {
  const prefix = `${name}=`;
  for (const header of setCookies) {
    const pair = header.split(';')[0]?.trim() ?? '';
    if (pair.startsWith(prefix)) {
      return decodeURIComponent(pair.slice(prefix.length));
    }
  }
  return undefined;
}
