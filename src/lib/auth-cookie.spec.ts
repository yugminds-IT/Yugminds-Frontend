import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cookieValue, getSetCookies } from './cookie-parse.ts';

describe('cookieValue / getSetCookies', () => {
  it('reads refresh_token from a backend Set-Cookie header (login BFF path)', () => {
    const headers = new Headers();
    headers.append(
      'set-cookie',
      'refresh_token=refresh-from-backend; Path=/; HttpOnly; SameSite=Strict',
    );
    headers.append('set-cookie', 'other=nope; Path=/');

    const value = cookieValue(getSetCookies(headers), 'refresh_token');
    assert.equal(value, 'refresh-from-backend');
  });

  it('returns undefined when the named cookie is absent', () => {
    const headers = new Headers({ 'set-cookie': 'access_token=abc; Path=/' });
    assert.equal(cookieValue(getSetCookies(headers), 'refresh_token'), undefined);
  });

  it('decodes percent-encoded cookie values', () => {
    assert.equal(
      cookieValue(['refresh_token=a%2Fb%2Bc; Path=/'], 'refresh_token'),
      'a/b+c',
    );
  });

  it('lets the login BFF copy backend Set-Cookie onto the frontend response', () => {
    const backend = new Headers();
    backend.append('set-cookie', 'refresh_token=keep-me; Path=/; HttpOnly');
    const outbound = new Headers();
    outbound.set('content-type', 'application/json');
    for (const cookie of getSetCookies(backend)) {
      outbound.append('set-cookie', cookie);
    }
    assert.equal(cookieValue(getSetCookies(outbound), 'refresh_token'), 'keep-me');
  });
});
