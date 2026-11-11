'use client';

import { io, Socket } from 'socket.io-client';
import { getAuthToken } from '../api/axios';

type SocketEventHandler<T = unknown> = (payload: T) => void;
export type RealtimeConnectionState = 'connecting' | 'connected' | 'stable' | 'reconnecting' | 'idle';

class RealtimeSocketClient {
  private socket: Socket | null = null;
  private listeners = new Map<string, Set<SocketEventHandler>>();
  private isConnected = false;
  private hasConnectedOnce = false;
  private idleDisconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stableTimer: ReturnType<typeof setTimeout> | null = null;
  private serverRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private serverRetries = 0;
  private state: RealtimeConnectionState = 'idle';

  private debug(event: string, payload?: unknown): void {
    if (process.env.NODE_ENV === 'production') return;
    if (process.env.NEXT_PUBLIC_REALTIME_DEBUG !== '1') return;
    console.debug(`[realtime] ${event}`, payload ?? '');
  }

  private getBaseUrl(): string {
    // Use dedicated realtime URL (direct NestJS origin) if set; fall back to localhost NestJS default.
    // NEXT_PUBLIC_API_BASE_URL points to the Next.js /api proxy which cannot proxy WebSockets.
    return process.env.NEXT_PUBLIC_REALTIME_URL || 'http://localhost:3001';
  }

  private setState(next: RealtimeConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    this.emitToLocal('socket:state', next);
    this.debug('state', { state: next });
  }

  private scheduleStableState(): void {
    if (this.stableTimer) clearTimeout(this.stableTimer);
    this.stableTimer = setTimeout(() => {
      if (this.socket?.connected) {
        this.serverRetries = 0; // it stayed up, so the server accepted us
        this.setState('stable');
      }
      this.stableTimer = null;
    }, 1200);
  }

  /**
   * socket.io reconnects by itself after a network drop, but NOT when the server ends the connection.
   * The server does that when it rejects the token right after the handshake (for example a page that
   * connected before login finished). Reconnect ourselves, with growing delays; the auth function above
   * then sends whatever token exists by then.
   */
  private retryAfterServerDisconnect(): void {
    if (this.serverRetryTimer) return;
    const delay = Math.min(1000 * 2 ** this.serverRetries, 10_000);
    this.serverRetries += 1;
    this.serverRetryTimer = setTimeout(() => {
      this.serverRetryTimer = null;
      const hasConsumers = Array.from(this.listeners.values()).some((set) => set.size > 0);
      if (hasConsumers && this.socket && !this.socket.connected) this.socket.connect();
    }, delay);
  }

  private ensureSocket(): Socket {
    if (this.socket) return this.socket;

    this.socket = io(`${this.getBaseUrl()}/realtime`, {
      transports: ['websocket'],
      autoConnect: false,
      withCredentials: true,
      // Function form: re-read the in-memory token on every (re)connect attempt, otherwise
      // a socket created before login/refresh retries forever with an empty token.
      auth: (cb) => cb({ token: getAuthToken() ?? '' }),
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.setState('connected');
      this.scheduleStableState();
      this.emitToLocal('socket:connected', true);
      this.socket?.emit('notifications:sync');
      this.socket?.emit('dashboard:sync');
      this.emitToLocal('socket:resync', { reconnect: this.hasConnectedOnce });
      this.debug('connect', { id: this.socket?.id, reconnect: this.hasConnectedOnce });
      this.hasConnectedOnce = true;
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      if (this.stableTimer) {
        clearTimeout(this.stableTimer);
        this.stableTimer = null;
      }
      this.emitToLocal('socket:connected', false);
      const hasConsumers = Array.from(this.listeners.values()).some((set) => set.size > 0);
      if (!hasConsumers) {
        this.setState('idle');
      } else if (reason === 'io client disconnect') {
        this.setState('idle');
      } else {
        this.setState('reconnecting');
        if (reason === 'io server disconnect') this.retryAfterServerDisconnect();
      }
      this.debug('disconnect', { reason });
    });

    this.socket.on('connect_error', (error) => {
      this.setState(this.hasConnectedOnce ? 'reconnecting' : 'connecting');
      this.emitToLocal('socket:error', { message: error.message });
      this.debug('connect_error', { message: error.message });
    });

    this.socket.io.on('reconnect_attempt', () => {
      this.setState('reconnecting');
    });

    return this.socket;
  }

  private emitToLocal(event: string, payload: unknown): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const handler of handlers) handler(payload);
  }

  connect(): void {
    const socket = this.ensureSocket();
    if (this.idleDisconnectTimer) {
      clearTimeout(this.idleDisconnectTimer);
      this.idleDisconnectTimer = null;
    }
    if (!socket.connected && !socket.active) {
      this.setState(this.hasConnectedOnce ? 'reconnecting' : 'connecting');
      socket.connect();
    }
  }

  disconnectIfIdle(): void {
    const hasConsumers = Array.from(this.listeners.values()).some((set) => set.size > 0);
    if (hasConsumers) return;
    if (this.idleDisconnectTimer) return;
    // Debounce disconnect to avoid connect/disconnect churn during re-renders.
    this.idleDisconnectTimer = setTimeout(() => {
      this.idleDisconnectTimer = null;
      const stillHasConsumers = Array.from(this.listeners.values()).some((set) => set.size > 0);
      if (!stillHasConsumers && this.socket?.connected) {
        this.socket.disconnect();
        this.setState('idle');
      }
    }, 1500);
  }

  on<T = unknown>(event: string, handler: SocketEventHandler<T>): () => void {
    const socket = this.ensureSocket();
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
      socket.on(event, (payload: T) => this.emitToLocal(event, payload));
    }

    this.listeners.get(event)?.add(handler as SocketEventHandler);
    this.connect();

    return () => {
      this.listeners.get(event)?.delete(handler as SocketEventHandler);
      this.disconnectIfIdle();
    };
  }

  get connected(): boolean {
    return this.isConnected;
  }

  get connectionState(): RealtimeConnectionState {
    return this.state;
  }
}

export const realtimeSocketClient = new RealtimeSocketClient();
