import { GuestStartSchema } from '@nlm/shared';
import { z } from 'zod';

/** Why a sign-in or sign-up failed, as far as the form can tell the user. */
export const AUTH_FAILURE = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  WEAK_PASSWORD: 'WEAK_PASSWORD',
  WRONG_PASSWORD: 'WRONG_PASSWORD',
  GUEST_UNAVAILABLE: 'NO_GUEST_AVAILABLE',
  UNKNOWN: 'UNKNOWN',
} as const;

export type AuthFailure = (typeof AUTH_FAILURE)[keyof typeof AUTH_FAILURE];

export class AuthError extends Error {
  readonly failure: AuthFailure;

  constructor(failure: AuthFailure) {
    super(failure);
    this.name = 'AuthError';
    this.failure = failure;
  }
}

// The codes Better Auth answers with (its own contract, not ours). Anything else is UNKNOWN.
const FAILURE_BY_CODE: Record<string, AuthFailure> = {
  INVALID_EMAIL_OR_PASSWORD: AUTH_FAILURE.INVALID_CREDENTIALS,
  USER_ALREADY_EXISTS: AUTH_FAILURE.EMAIL_TAKEN,
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: AUTH_FAILURE.EMAIL_TAKEN,
  PASSWORD_TOO_SHORT: AUTH_FAILURE.WEAK_PASSWORD,
  PASSWORD_TOO_LONG: AUTH_FAILURE.WEAK_PASSWORD,
  INVALID_PASSWORD: AUTH_FAILURE.WRONG_PASSWORD,
};

const GUEST_UNAVAILABLE_STATUS = 503;

const SessionSchema = z
  .object({
    user: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      /** Set for a guest of the live demo. */
      isAnonymous: z.boolean().nullish(),
    }),
  })
  .nullable();
const AuthErrorBodySchema = z.object({ code: z.string() });

export type SessionUser = NonNullable<z.infer<typeof SessionSchema>>['user'];

async function failure(response: Response): Promise<AuthError> {
  const body = AuthErrorBodySchema.safeParse(await response.json().catch(() => null));
  return new AuthError((body.success && FAILURE_BY_CODE[body.data.code]) || AUTH_FAILURE.UNKNOWN);
}

async function postJson(path: string, body: unknown): Promise<void> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await failure(response);
}

/** The signed-in user, or null. A server error throws: it is not the same as "signed out". */
export async function getSession(): Promise<SessionUser | null> {
  const response = await fetch('/api/auth/get-session');
  if (!response.ok) throw await failure(response);
  return SessionSchema.parse(await response.json())?.user ?? null;
}

export const signIn = (email: string, password: string) =>
  postJson('/api/auth/sign-in/email', { email, password });

// The product has no display name; the email address serves as the account name.
export const signUp = (email: string, password: string) =>
  postJson('/api/auth/sign-up/email', { name: email, email, password });

/**
 * A guest of the live demo, signed in with a copy of the example notebook. Returns the ID of that
 * notebook. The server answers with its own error codes (ours, not Better Auth's).
 */
export async function startGuest(): Promise<string> {
  const response = await fetch('/api/guest', { method: 'POST' });
  if (response.status === GUEST_UNAVAILABLE_STATUS) {
    throw new AuthError(AUTH_FAILURE.GUEST_UNAVAILABLE);
  }
  if (!response.ok) throw new AuthError(AUTH_FAILURE.UNKNOWN);
  return GuestStartSchema.parse(await response.json()).notebookId;
}

export const signOut = () => postJson('/api/auth/sign-out', {});

/** Removes the account with everything in it. The server wants the password once more. */
export const deleteAccount = (password: string) => postJson('/api/auth/delete-user', { password });
