'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { notifyManager } from '@tanstack/query-core';
import { realtimeSocketClient, type RealtimeConnectionState } from '../lib/realtime/socket-client';
import { resolveEventQueryMap, type EventQueryMap, type RealtimeEventName } from '../lib/realtime/event-query-map';
import { queryKeys, type QueryKeyLike } from '../lib/query-keys';

export type RealtimeRole = 'admin' | 'school_admin' | 'teacher' | 'student';

export interface UseDashboardRealtimeOptions {
  enabled?: boolean;
  debug?: boolean;
  debugLabel?: string;
  customEventMap?: EventQueryMap;
  extraInvalidateKeys?: QueryKeyLike[];
  onEvent?: (payload: { eventType: RealtimeEventName; data?: Record<string, unknown> }) => void;
  onStats?: (payload: Record<string, unknown>) => void;
}

const roleStatsKey: Record<RealtimeRole, QueryKeyLike> = {
  admin: queryKeys.admin.dashboardStats,
  school_admin: queryKeys.schoolAdmin.dashboardStats,
  teacher: queryKeys.teacher.dashboard,
  student: queryKeys.student.dashboardStats,
};

export function useDashboardRealtime(role: RealtimeRole, options: UseDashboardRealtimeOptions = {}) {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [_connectionState, setConnectionState] = useState<RealtimeConnectionState>('idle');
  const connectionStateRef = useRef<RealtimeConnectionState>('idle');
  const pendingInvalidationsRef = useRef<Map<string, QueryKeyLike>>(new Map());
  const handledEventRef = useRef<Map<string, number>>(new Map());
  const pendingEventsRef = useRef<Map<RealtimeEventName, unknown[]>>(new Map());
  const reconnectBufferRef = useRef<Map<RealtimeEventName, unknown[]>>(new Map());
  const pendingResyncRef = useRef(false);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastResyncAtRef = useRef(0);

  const {
    enabled = true,
    debug = false,
    debugLabel,
    customEventMap,
    extraInvalidateKeys = [],
    onEvent,
    onStats,
  } = options;

  const onEventRef = useRef(onEvent);
  const onStatsRef = useRef(onStats);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);
  useEffect(() => {
    onStatsRef.current = onStats;
  }, [onStats]);

  const customEventMapKey = useMemo(() => JSON.stringify(customEventMap ?? {}), [customEventMap]);
  const extraInvalidateKeysKey = useMemo(() => JSON.stringify(extraInvalidateKeys ?? []), [extraInvalidateKeys]);
  const normalizedExtraInvalidateKeys = useMemo<QueryKeyLike[]>(
    () => (JSON.parse(extraInvalidateKeysKey) as QueryKeyLike[]) ?? [],
    [extraInvalidateKeysKey],
  );
  const eventMap = useMemo(
    () => resolveEventQueryMap(role, customEventMap),
    // Intentionally key off serialized map to avoid effect churn from inline object literals.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customEventMapKey, role],
  );
  const statsKey = roleStatsKey[role];
  useEffect(() => {
    if (!enabled) return;
    const debugEnabled = debug || (process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_REALTIME_DEBUG === '1');
    const BATCH_WINDOW_MS = 200;

    const flushInvalidations = () => {
      if (pendingInvalidationsRef.current.size === 0) return;
      const keys = Array.from(pendingInvalidationsRef.current.values());
      pendingInvalidationsRef.current.clear();
      notifyManager.batch(() => {
        for (const key of keys) {
          queryClient.invalidateQueries({ queryKey: key, refetchType: 'active' });
        }
      });
      if (debugEnabled) console.debug('[realtime] flush-invalidations', { role, label: debugLabel, keys });
    };

    const enqueueInvalidation = (key: QueryKeyLike) => {
      pendingInvalidationsRef.current.set(JSON.stringify(key), key);
    };

    const invalidateForEvent = (event: RealtimeEventName) => {
      const mapped = eventMap[event] ?? [];
      for (const key of mapped) enqueueInvalidation(key);
      for (const key of normalizedExtraInvalidateKeys) enqueueInvalidation(key);
    };

    const shouldDropDuplicate = (event: RealtimeEventName, payload: unknown): boolean => {
      let payloadKey = '';
      try {
        payloadKey = JSON.stringify(payload ?? {});
      } catch {
        payloadKey = String(payload ?? '');
      }
      const key = `${event}:${payloadKey}`;
      const now = Date.now();
      const last = handledEventRef.current.get(key);
      handledEventRef.current.set(key, now);
      if (last && now - last < 400) return true;
      // Cheap cleanup to keep map bounded.
      if (handledEventRef.current.size > 500) {
        for (const [k, ts] of handledEventRef.current.entries()) {
          if (now - ts > 30_000) handledEventRef.current.delete(k);
        }
      }
      return false;
    };

    const scheduleEventFlush = () => {
      if (flushTimerRef.current) return;
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        if (connectionStateRef.current !== 'stable') return;

        if (pendingResyncRef.current) {
          // Run resync recovery inside the same batched flush cycle.
          enqueueInvalidation(statsKey);
          enqueueInvalidation(queryKeys.shared.unreadNotificationCount);
          pendingResyncRef.current = false;
        }

        const batchedEvents = new Map(pendingEventsRef.current);
        pendingEventsRef.current.clear();
        if (batchedEvents.size === 0) {
          flushInvalidations();
          return;
        }

        // notification:unread_count -> setQueryData only (latest wins)
        const unreadEvents = batchedEvents.get('notification:unread_count');
        if (unreadEvents && unreadEvents.length > 0) {
          const payload = unreadEvents[unreadEvents.length - 1] as { count?: number };
          queryClient.setQueryData(queryKeys.shared.unreadNotificationCount, Number(payload?.count ?? 0));
          onEventRef.current?.({ eventType: 'notification:unread_count', data: payload as Record<string, unknown> });
        }

        // dashboard:stats -> setQueryData only (latest wins)
        const statsEvents = batchedEvents.get('dashboard:stats');
        if (statsEvents && statsEvents.length > 0) {
          const payload = statsEvents[statsEvents.length - 1] as Record<string, unknown>;
          queryClient.setQueryData(statsKey, (old: unknown) =>
            old && typeof old === 'object' ? { ...(old as Record<string, unknown>), ...payload } : payload,
          );
          onStatsRef.current?.(payload);
          onEventRef.current?.({ eventType: 'dashboard:stats', data: payload });
        }

        // notification:new -> invalidate only (one invalidate burst)
        const newEvents = batchedEvents.get('notification:new');
        if (newEvents && newEvents.length > 0) {
          invalidateForEvent('notification:new');
          const payload = newEvents[newEvents.length - 1] as Record<string, unknown>;
          onEventRef.current?.({ eventType: 'notification:new', data: payload });
        }

        // notification:read -> invalidate only (one invalidate burst)
        const readEvents = batchedEvents.get('notification:read');
        if (readEvents && readEvents.length > 0) {
          invalidateForEvent('notification:read');
          const payload = readEvents[readEvents.length - 1] as Record<string, unknown>;
          onEventRef.current?.({ eventType: 'notification:read', data: payload });
        }

        flushInvalidations();

        if (debugEnabled) {
          console.debug('[realtime] flush-events', {
            role,
            label: debugLabel,
            batch_window_ms: BATCH_WINDOW_MS,
            events: Array.from(batchedEvents.entries()).map(([event, items]) => ({ event, count: items.length })),
          });
        }
      }, BATCH_WINDOW_MS);
    };

    const enqueueEvent = (event: RealtimeEventName, payload: unknown) => {
      const target =
        connectionStateRef.current === 'stable'
          ? pendingEventsRef.current
          : reconnectBufferRef.current;
      const current = target.get(event) ?? [];
      current.push(payload);
      target.set(event, current);
      if (connectionStateRef.current === 'stable') {
        scheduleEventFlush();
      }
    };

    const flushReconnectBufferIntoPending = () => {
      if (reconnectBufferRef.current.size === 0) return;
      for (const [event, items] of reconnectBufferRef.current.entries()) {
        const current = pendingEventsRef.current.get(event) ?? [];
        current.push(...items);
        pendingEventsRef.current.set(event, current);
      }
      reconnectBufferRef.current.clear();
      scheduleEventFlush();
    };

    const unsubConnect = realtimeSocketClient.on<boolean>('socket:connected', (connected) => {
      setIsConnected(Boolean(connected));
    });

    const unsubState = realtimeSocketClient.on<RealtimeConnectionState>('socket:state', (state) => {
      connectionStateRef.current = state;
      setConnectionState(state);
      if (state === 'stable') {
        flushReconnectBufferIntoPending();
      }
    });

    const unsubResync = realtimeSocketClient.on<{ reconnect?: boolean }>('socket:resync', () => {
      const now = Date.now();
      if (now - lastResyncAtRef.current < 1000) return;
      lastResyncAtRef.current = now;
      // Do not invalidate immediately on reconnect; defer to stable batch flush.
      pendingResyncRef.current = true;
      if (connectionStateRef.current === 'stable') scheduleEventFlush();
      if (debugEnabled) console.debug('[realtime] socket:resync', { role, label: debugLabel });
    });

    const unsubUnread = realtimeSocketClient.on<{ count?: number }>('notification:unread_count', (payload) => {
      if (shouldDropDuplicate('notification:unread_count', payload)) return;
      enqueueEvent('notification:unread_count', payload);
    });

    const unsubNew = realtimeSocketClient.on<{ id?: string }>('notification:new', (payload) => {
      if (shouldDropDuplicate('notification:new', payload)) return;
      enqueueEvent('notification:new', payload);
    });

    const unsubRead = realtimeSocketClient.on<{ notification_id?: string; mark_all?: boolean }>('notification:read', (payload) => {
      if (shouldDropDuplicate('notification:read', payload)) return;
      enqueueEvent('notification:read', payload);
    });

    const unsubStats = realtimeSocketClient.on<Record<string, unknown>>('dashboard:stats', (payload) => {
      if (shouldDropDuplicate('dashboard:stats', payload)) return;
      enqueueEvent('dashboard:stats', payload);
    });

    return () => {
      unsubConnect();
      unsubState();
      unsubResync();
      unsubUnread();
      unsubNew();
      unsubRead();
      unsubStats();
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
      pendingEventsRef.current.clear();
      // eslint-disable-next-line react-hooks/exhaustive-deps
      reconnectBufferRef.current.clear();
      pendingResyncRef.current = false;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      pendingInvalidationsRef.current.clear();
      // eslint-disable-next-line react-hooks/exhaustive-deps
      handledEventRef.current.clear();
      setIsConnected(false);
      connectionStateRef.current = 'idle';
      setConnectionState('idle');
    };
  }, [debug, debugLabel, enabled, eventMap, normalizedExtraInvalidateKeys, queryClient, role, statsKey]);

  return { isConnected };
}
