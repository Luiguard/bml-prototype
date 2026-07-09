import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { verifyPassword, createToken, checkRateLimit } from '@/lib/auth';
import { db } from '@/lib/db';
import type { UserSession, Role } from '@/types';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  if (!checkRateLimit(`login:${ip}`, 5, 60000)) {
    return Response.json(
      { success: false, error: 'Zu viele Anmeldeversuche. Bitte warten.' },
      { status: 429 }
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: 'Ungültige Anfrage' }, { status: 400 });
  }

  const { email, password } = body;
  if (!email || !password) {
    return Response.json({ success: false, error: 'E-Mail und Passwort erforderlich' }, { status: 400 });
  }

  const user = await db.user.findFirst({
    where: { email: email.toLowerCase().trim() },
  });

  if (!user || !user.active) {
    return Response.json({ success: false, error: 'E-Mail oder Passwort falsch' }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return Response.json({ success: false, error: 'E-Mail oder Passwort falsch' }, { status: 401 });
  }

  const session: UserSession = {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role as Role,
    modules: JSON.parse(user.modules as string || '[]'),
    locale: user.locale,
  };

  const token = createToken(session);

  const cookieStore = await cookies();
  cookieStore.set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
    path: '/',
  });

  return Response.json({ success: true, data: session });
}
