import { API_BASE } from '../constants/config';
import { getStoredSession } from './auth';
import type {
  ApiErrorBody,
  GetAvailabilityParams,
  GetAvailabilityResponse,
  GetChatSessionChannelParams,
  GetChatSessionChannelResponse,
  GetCreditsResponse,
  GetMyBookingsResponse,
  GetPaymentConfirmationChannelParams,
  GetPaymentConfirmationChannelResponse,
  GetPricingResponse,
  GetScheduleResponse,
  GetStripeSessionParams,
  GetStripeSessionResponse,
  GetSubscribeParams,
  GetSubscribeResponse,
  PostBookRequest,
  PostBookResponse,
  PostCancelRequest,
  PostCancelResponse,
  PostChatRequest,
  PostChatResponse,
  PostChatSessionRequest,
  PostChatSessionResponse,
  PostLocaleRequest,
  PostLocaleResponse,
  PostReviewRequest,
  PostReviewResponse,
  PostStripeCheckoutRequest,
  PostStripeCheckoutResponse,
  PostSubscribeRequest,
  PostSubscribeResponse,
  PostZoomTokenRequest,
  PostZoomTokenResponse,
} from '../types/api';

// ── Error ─────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly requiresAuth?: boolean,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── 401 refresh hook ──────────────────────────────────────────────────────────
// Wired by the auth context (lib/auth-context.tsx) at app init. On a 401 from a
// protected route the client invokes this hook, which silently refreshes the
// bearer (single-flight; see lib/auth.ts refreshSession). It resolves:
//   true  → a new bearer was written to the in-memory cache; retry the request.
//   false → refresh gave up (no cached credential / network / backend reject);
//           the hook has already signed out + routed to login, so surface the 401.

type RefreshHook = () => Promise<boolean>;
let _refreshHook: RefreshHook | null = null;

export function registerRefreshHook(fn: RefreshHook): void {
  _refreshHook = fn;
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  params?: object;
  body?: unknown;
}

async function request<T>(
  method: HttpMethod,
  path: string,
  options?: RequestOptions,
): Promise<T> {
  return attemptRequest<T>(method, path, options, false);
}

async function attemptRequest<T>(
  method: HttpMethod,
  path: string,
  options: RequestOptions | undefined,
  isRetry: boolean,
): Promise<T> {
  const url = buildUrl(path, options?.params);
  const headers = buildHeaders(method);

  const res = await fetch(url, {
    method,
    headers,
    body: method !== 'GET' && options?.body !== undefined
      ? JSON.stringify(options.body)
      : undefined,
  });

  // Only a 401 triggers a refresh, and at most once per request (isRetry caps it):
  // a still-401 after refresh, or any other status (403/429/500…), falls through.
  if (res.status === 401 && !isRetry && _refreshHook) {
    const refreshed = await _refreshHook();
    if (refreshed) return attemptRequest<T>(method, path, options, true);
    // Refresh gave up — fall through and surface the 401 below.
  }

  if (!res.ok) {
    let body: ApiErrorBody = { error: `HTTP ${res.status}` };
    try { body = (await res.json()) as ApiErrorBody; } catch { /* keep default */ }
    throw new ApiError(body.error, res.status, body.error, body.requiresAuth);
  }

  return res.json() as Promise<T>;
}

function buildUrl(path: string, params?: object): string {
  const url = new URL(API_BASE + path);
  if (params) {
    for (const [k, v] of Object.entries(params) as [string, unknown][]) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

function buildHeaders(method: HttpMethod): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const session = getStoredSession();
  if (session) {
    headers['Authorization'] = `Bearer ${session.token}`;
  }
  if (method !== 'GET') {
    headers['Origin'] = API_BASE;
  }
  return headers;
}

// ── Typed endpoint methods ────────────────────────────────────────────────────

export const api = {
  getSchedule(): Promise<GetScheduleResponse> {
    return request('GET', '/api/schedule');
  },

  getAvailability(params: GetAvailabilityParams): Promise<GetAvailabilityResponse> {
    return request('GET', '/api/availability', { params });
  },

  postBook(body: PostBookRequest): Promise<PostBookResponse> {
    return request('POST', '/api/book', { body });
  },

  postCancel(body: PostCancelRequest): Promise<PostCancelResponse> {
    return request('POST', '/api/cancel', { body });
  },

  postStripeCheckout(body: PostStripeCheckoutRequest): Promise<PostStripeCheckoutResponse> {
    return request('POST', '/api/stripe/checkout', { body });
  },

  getStripeSession(params: GetStripeSessionParams): Promise<GetStripeSessionResponse> {
    return request('GET', '/api/stripe/session', { params });
  },

  getPaymentConfirmationChannel(
    params: GetPaymentConfirmationChannelParams,
  ): Promise<GetPaymentConfirmationChannelResponse> {
    return request('GET', '/api/payment-confirmation/channel', { params });
  },

  postZoomToken(body: PostZoomTokenRequest): Promise<PostZoomTokenResponse> {
    return request('POST', '/api/zoom/token', { body });
  },

  getChatSessionChannel(
    params: GetChatSessionChannelParams,
  ): Promise<GetChatSessionChannelResponse> {
    return request('GET', '/api/chat-session/channel', { params });
  },

  postChatSession(body: PostChatSessionRequest): Promise<PostChatSessionResponse> {
    return request('POST', '/api/chat-session', { body });
  },

  postChat(body: PostChatRequest): Promise<PostChatResponse> {
    return request('POST', '/api/chat', { body });
  },

  getCredits(): Promise<GetCreditsResponse> {
    return request('GET', '/api/credits');
  },

  getPricing(): Promise<GetPricingResponse> {
    return request('GET', '/api/pricing');
  },

  postLocale(body: PostLocaleRequest): Promise<PostLocaleResponse> {
    return request('POST', '/api/locale', { body });
  },

  getMyBookings(): Promise<GetMyBookingsResponse> {
    return request('GET', '/api/my-bookings');
  },

  postReview(body: PostReviewRequest): Promise<PostReviewResponse> {
    return request('POST', '/api/reviews', { body });
  },

  getSubscribeStatus(params: GetSubscribeParams): Promise<GetSubscribeResponse> {
    return request('GET', '/api/subscribe', { params });
  },

  postSubscribe(body: PostSubscribeRequest): Promise<PostSubscribeResponse> {
    return request('POST', '/api/subscribe', { body });
  },
};
