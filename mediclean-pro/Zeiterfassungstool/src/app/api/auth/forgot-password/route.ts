import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { checkRateLimit } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  if (!checkRateLimit(`forgot:${ip}`, 3, 300000)) { // max 3 per 5 minutes
    return Response.json(
      { success: false, error: 'Zu viele Anfragen. Bitte warten.' },
      { status: 429 }
    );
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: 'Ungültige Anfrage' }, { status: 400 });
  }

  const { email } = body;
  if (!email) {
    return Response.json({ success: false, error: 'E-Mail erforderlich' }, { status: 400 });
  }

  const user = await db.user.findFirst({
    where: { email: email.toLowerCase().trim() },
  });

  // Immer Erfolg zurückgeben, um User Enumeration zu verhindern
  if (!user || !user.active) {
    return Response.json({ success: true, message: 'Falls die E-Mail existiert, wurde ein Link versendet.' });
  }

  // Token generieren
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 Stunde gültig

  await db.user.update({
    where: { id: user.id },
    data: { resetToken, resetTokenExpiry },
  });

  // HIER WÜRDE DER E-MAIL-VERSAND STEHEN
  // Da dies ein Demo-MVP ohne SMTP ist, loggen wir den Link in die Konsole
  const resetLink = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/passwort-reset?token=${resetToken}`;
  console.log('----------------------------------------------------');
  console.log(`PASSWORT RESET LINK FÜR ${user.email}:`);
  console.log(resetLink);
  console.log('----------------------------------------------------');

  return Response.json({ success: true, message: 'Falls die E-Mail existiert, wurde ein Link versendet. (Siehe Server-Konsole im Demo-Modus)' });
}
