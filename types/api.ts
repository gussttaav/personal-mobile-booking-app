// ── Shared ────────────────────────────────────────────────────────────────────

export type SessionType = 'free15min' | 'session1h' | 'session2h' | 'pack';

export type Locale = 'es' | 'en';

export type SubscriptionType = 'courses' | 'blog';

export type ApiErrorCode =
  | 'INSUFFICIENT_CREDITS'
  | 'SLOT_UNAVAILABLE'
  | 'INVALID_RESCHEDULE_TOKEN'
  | 'OUTSIDE_RESCHEDULE_WINDOW'
  | 'SESSION_TYPE_MISMATCH'
  | 'RESCHEDULE_TOKEN_CONSUMED'
  | 'REQUIRES_PAYMENT'
  | 'INVALID_CANCEL_TOKEN'
  | 'OUTSIDE_CANCEL_WINDOW'
  | 'CANCEL_TOKEN_CONSUMED'
  | 'BOOKING_NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'ALREADY_SUBSCRIBED'
  | 'REVIEW_BOOKING_NOT_FOUND'
  | 'INVALID_REQUEST'
  | 'INTERNAL_ERROR';

export interface ApiErrorBody {
  error: string;
  requiresAuth?: boolean;
}

// ── Availability ──────────────────────────────────────────────────────────────

export interface AvailabilitySlot {
  start: string;
  end: string;
  label: string;
  localLabel: string;
}

export interface GetAvailabilityParams {
  date: string;
  duration?: 15 | 30 | 60 | 120;
  tz?: string;
}

export interface GetAvailabilityResponse {
  slots: AvailabilitySlot[];
  timezone: string;
}

// ── Booking ───────────────────────────────────────────────────────────────────

export interface PostBookRequest {
  startIso: string;
  endIso: string;
  sessionType: SessionType;
  note?: string;
  timezone: string;
  rescheduleToken?: string;
}

export interface PostBookResponse {
  ok: true;
  eventId: string;
  zoomSessionName: string;
  zoomPasscode: string;
  cancelToken: string;
  joinToken: string;
  emailFailed: boolean;
}

export interface PostCancelRequest {
  token: string;
}

export interface PostCancelResponse {
  ok: true;
  sessionLabel: string;
  startIso: string;
  creditsRestored: boolean;
}

// ── Payment ───────────────────────────────────────────────────────────────────

export type PostStripeCheckoutRequest =
  | { type: 'pack'; packSize: 5 | 10 }
  | {
      type: 'single';
      duration: '1h' | '2h';
      startIso: string;
      endIso: string;
      rescheduleToken?: string;
    };

export interface PostStripeCheckoutResponse {
  clientSecret: string;
  paymentIntentId: string;
}

export interface GetStripeSessionParams {
  payment_intent_id: string;
}

export type GetStripeSessionResponse =
  | { checkoutType: 'pack'; email: string; name: string; packSize: number }
  | { checkoutType: 'single'; email: string; name: string; sessionDuration: '1h' | '2h' };

export interface GetPaymentConfirmationChannelParams {
  payment_intent_id: string;
}

export interface GetPaymentConfirmationChannelResponse {
  channelName: string;
  confirmed: boolean;
  credits: number | null;
  name: string;
  packSize: number | null;
}

// ── Zoom ──────────────────────────────────────────────────────────────────────

export interface PostZoomTokenRequest {
  eventId: string;
}

export interface PostZoomTokenResponse {
  token: string;
  sessionName: string;
  userName: string;
  role: 0 | 1;
}

// ── Chat session (in-session messaging) ──────────────────────────────────────

export interface GetChatSessionChannelParams {
  eventId: string;
}

export interface ChatMessage {
  sender: string;
  text: string;
  createdAt: string;
}

export interface GetChatSessionChannelResponse {
  channelName: string;
  initialMessages: ChatMessage[];
}

export interface PostChatSessionRequest {
  eventId: string;
  text: string;
}

export interface PostChatSessionResponse {
  ok: true;
}

// ── AI chat ───────────────────────────────────────────────────────────────────

export interface PostChatRequest {
  message: string;
  sessionId?: string;
}

export interface PostChatResponse {
  reply: string;
  sessionId: string;
}

// ── Profile ───────────────────────────────────────────────────────────────────

export interface GetCreditsResponse {
  credits: number;
  name: string;
  packSize: number | null;
  hasBookings: boolean;
}

export interface PostLocaleRequest {
  locale: Locale;
}

export interface PostLocaleResponse {
  ok: true;
}

// ── History ───────────────────────────────────────────────────────────────────

export interface Booking {
  token: string;
  joinToken: string;
  sessionType: SessionType;
  startsAt: string;
  endsAt: string;
  packSize?: number;
}

export interface GetMyBookingsResponse {
  bookings: Booking[];
}

// ── Reviews ───────────────────────────────────────────────────────────────────

export type PostReviewRequest =
  | { kind: 'rating'; eventId: string; rating: 1 | 2 | 3 | 4 | 5 }
  | { kind: 'comment'; eventId: string; comment: string }
  | { kind: 'google'; action: 'accept' | 'decline' };

export type PostReviewResponse =
  | { ok: true; showGoogleReview: boolean }
  | { ok: true };

// ── Subscriptions ─────────────────────────────────────────────────────────────

export interface GetSubscribeParams {
  type: SubscriptionType;
}

export interface GetSubscribeResponse {
  subscribed: boolean;
}

export interface PostSubscribeRequest {
  type: SubscriptionType;
}

export interface PostSubscribeResponse {
  ok: true;
}
