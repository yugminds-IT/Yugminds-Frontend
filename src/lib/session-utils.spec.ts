import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  safeNextPath,
  loginRedirectUrl,
  isAccessTokenExpiringSoon,
  setInMemoryToken,
  getStoredUserId,
  tryRefreshSession,
  getStoredSession,
  clearStoredSession,
} from './session-utils.ts';

function jwtWith(payload: Record<string, unknown>): string {
  const json = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `hdr.${json}.sig`;
}

describe('safeNextPath', () => {
  it('allows in-app LMS routes', () => {
    assert.equal(safeNextPath('/lms/admin/courses'), '/lms/admin/courses');
    assert.equal(
      safeNextPath('/lms/teacher/assignments?id=1'),
      '/lms/teacher/assignments?id=1',
    );
  });

  it('rejects login/signup, off-site, and protocol-relative URLs', () => {
    assert.equal(safeNextPath(null), null);
    assert.equal(safeNextPath(''), null);
    assert.equal(safeNextPath('/lms/login'), null);
    assert.equal(safeNextPath('/lms/signup'), null);
    assert.equal(safeNextPath('https://evil.example/lms/admin'), null);
    assert.equal(safeNextPath('//evil.example/lms/admin'), null);
    assert.equal(safeNextPath('/about'), null);
  });
});

describe('loginRedirectUrl', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    const store: Record<string, string> = {};
    const sessionStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    };
    (globalThis as { window?: unknown }).window = {
      location: { pathname: '/lms/admin/courses', search: '' },
      sessionStorage,
    };
    (globalThis as { sessionStorage?: typeof sessionStorage }).sessionStorage =
      sessionStorage;
  });

  afterEach(() => {
    (globalThis as { window?: unknown }).window = originalWindow;
  });

  it('returns /lms/login?next= the page the user was on', () => {
    assert.equal(
      loginRedirectUrl('session_expired'),
      '/lms/login?next=%2Flms%2Fadmin%2Fcourses',
    );
  });
});

describe('isAccessTokenExpiringSoon', () => {
  beforeEach(() => setInMemoryToken(null));

  it('is true when no token is stored', () => {
    assert.equal(isAccessTokenExpiringSoon(), true);
  });

  it('is true when exp is within the skew window', () => {
    const exp = Math.floor(Date.now() / 1000) + 30;
    setInMemoryToken(jwtWith({ sub: 1, exp }));
    assert.equal(isAccessTokenExpiringSoon(90), true);
  });

  it('is false when exp is well in the future', () => {
    const exp = Math.floor(Date.now() / 1000) + 15 * 60;
    setInMemoryToken(jwtWith({ sub: 1, exp }));
    assert.equal(isAccessTokenExpiringSoon(90), false);
  });
});

describe('getStoredUserId', () => {
  beforeEach(() => setInMemoryToken(null));

  it('reads numeric JWT sub (backend encodes sub as a number)', () => {
    setInMemoryToken(jwtWith({ sub: 42, email: 'a@b.c' }));
    assert.equal(getStoredUserId(), '42');
  });
});

describe('clearStoredSession — shared lab draft wipe', () => {
  const originalWindow = globalThis.window;
  let store: Record<string, string>;
  let localStore: Record<string, string>;

  function makeStorage(backing: Record<string, string>) {
    return {
      get length() {
        return Object.keys(backing).length;
      },
      key(i: number) {
        return Object.keys(backing)[i] ?? null;
      },
      getItem: (k: string) => backing[k] ?? null,
      setItem: (k: string, v: string) => {
        backing[k] = v;
      },
      removeItem: (k: string) => {
        delete backing[k];
      },
      clear: () => {
        for (const k of Object.keys(backing)) delete backing[k];
      },
    };
  }

  beforeEach(() => {
    setInMemoryToken(jwtWith({ sub: 111 }));
    store = {};
    localStore = {};
    const sessionStorage = makeStorage(store);
    const localStorage = makeStorage(localStore);
    (globalThis as { window?: unknown }).window = {
      location: { pathname: '/lms/student/assignments/asg-1', search: '' },
      sessionStorage,
      localStorage,
    };
    (globalThis as { sessionStorage?: typeof sessionStorage }).sessionStorage =
      sessionStorage;
    (globalThis as { localStorage?: typeof localStorage }).localStorage =
      localStorage;
  });

  afterEach(() => {
    setInMemoryToken(null);
    (globalThis as { window?: unknown }).window = originalWindow;
  });

  it('wipes assignment autosave drafts so the next student cannot restore them', () => {
    const assignmentId = 'asg-shared-lab';
    // Legacy unscoped key (pre-fix) + student-A scoped key
    store[`session_form_data_student-assignment-${assignmentId}`] = JSON.stringify({
      data: { answers: { q1: { type: 'mcq', value: 2 } } },
      timestamp: Date.now(),
    });
    store[`session_form_data_student-assignment-111-${assignmentId}`] =
      JSON.stringify({
        data: { answers: { q1: { type: 'mcq', value: 2 } } },
        timestamp: Date.now(),
      });
    store['form-store'] = JSON.stringify({
      state: {
        formData: {
          [`student-assignment-111-${assignmentId}`]: {
            answers: { q1: { type: 'mcq', value: 2 } },
          },
        },
      },
    });
    localStore[`form_data_student-assignment-${assignmentId}`] = 'legacy-local';

    // Student B would use a different key — must not see A's draft even before logout
    assert.equal(
      store[`session_form_data_student-assignment-222-${assignmentId}`],
      undefined,
    );

    clearStoredSession(false);

    assert.equal(
      store[`session_form_data_student-assignment-${assignmentId}`],
      undefined,
    );
    assert.equal(
      store[`session_form_data_student-assignment-111-${assignmentId}`],
      undefined,
    );
    assert.equal(store['form-store'], undefined);
    assert.equal(
      localStore[`form_data_student-assignment-${assignmentId}`],
      undefined,
    );
    assert.equal(getStoredSession(), null);
  });
});

describe('tryRefreshSession', () => {
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    setInMemoryToken(null);
    const store: Record<string, string> = {};
    const sessionStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    };
    (globalThis as { window?: unknown }).window = {
      location: { pathname: '/lms/admin' },
      sessionStorage,
    };
    (globalThis as { sessionStorage?: typeof sessionStorage }).sessionStorage =
      sessionStorage;
  });

  afterEach(() => {
    (globalThis as { window?: unknown }).window = originalWindow;
    globalThis.fetch = originalFetch;
  });

  it('stores the access token from tokens.accessToken (BFF auth body)', async () => {
    const token = jwtWith({ sub: 9, email: 'user@test.com', exp: Math.floor(Date.now() / 1000) + 900 });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ tokens: { accessToken: token } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch;

    try {
      const ok = await tryRefreshSession();
      assert.equal(ok, true);
      assert.equal(getStoredSession()?.access_token, token);
      assert.equal(getStoredUserId(), '9');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('returns false on 401 without throwing', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: 'Missing refresh token' }), {
        status: 401,
      })) as typeof fetch;

    try {
      assert.equal(await tryRefreshSession(), false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
