import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export async function GET() {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get('token');

  if (!tokenCookie) {
    return Response.json(
      { success: false, error: 'Nicht angemeldet' },
      { status: 401 }
    );
  }

  const session = verifyToken(tokenCookie.value);
  if (!session) {
    cookieStore.delete('token');
    return Response.json(
      { success: false, error: 'Sitzung abgelaufen' },
      { status: 401 }
    );
  }

  return Response.json({ success: true, data: session });
}
