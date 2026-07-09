import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, checkRateLimit } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  if (!checkRateLimit(`reset:${ip}`, 5, 300000)) {
    return Response.json(
      { success: false, error: 'Zu viele Anfragen. Bitte warten.' },
      { status: 429 }
    );
  }

  let body: { token?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: 'Ungültige Anfrage' }, { status: 400 });
  }

  const { token, newPassword } = body;
  if (!token || !newPassword) {
    return Response.json({ success: false, error: 'Token und neues Passwort erforderlich' }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return Response.json({ success: false, error: 'Passwort muss mindestens 8 Zeichen lang sein' }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { resetToken: token },
  });

  if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date() || !user.active) {
    return Response.json({ success: false, error: 'Token ungültig oder abgelaufen' }, { status: 400 });
  }

  const newHash = await hashPassword(newPassword);

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newHash,
      resetToken: null,
      resetTokenExpiry: null,
    },
  });

  return Response.json({ success: true, message: 'Passwort erfolgreich geändert' });
}
