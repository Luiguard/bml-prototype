import { NextRequest, NextResponse } from 'next/server';
import type { UserSession, ApiResponse } from '@/types';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'dev-fallback';

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + JWT_SECRET);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === hash;
}

export function createToken(payload: UserSession): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(
    JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 15 * 60,
    })
  );
  const signature = btoa(header + '.' + body + '.' + JWT_SECRET);
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): UserSession | null {
  try {
    const [header, body, signature] = token.split('.');
    const expectedSig = btoa(header + '.' + body + '.' + JWT_SECRET);
    if (signature !== expectedSig) return null;

    const payload = JSON.parse(atob(body));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload as UserSession;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(req: NextRequest): UserSession | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    const cookie = req.cookies.get('token');
    if (!cookie) return null;
    return verifyToken(cookie.value);
  }
  return verifyToken(authHeader.slice(7));
}

export function unauthorized(): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error: 'Nicht autorisiert' }, { status: 401 });
}

export function forbidden(): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error: 'Keine Berechtigung' }, { status: 403 });
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, maxRequests = 5, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) return false;

  entry.count++;
  return true;
}
