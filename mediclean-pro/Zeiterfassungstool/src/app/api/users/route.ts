import { cookies } from 'next/headers';
import { verifyToken, hashPassword } from '@/lib/auth';
import { db } from '@/lib/db';
import type { Role } from '@/types';

const ROLE_LABELS: Record<string, string> = {
  EMPLOYEE: 'Mitarbeiter',
  SUPERVISOR: 'Vorgesetzter',
  HR_ADMIN: 'HR/Admin',
  SYSTEM_ADMIN: 'System-Admin',
};

async function requireAdmin() {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get('token');
  if (!tokenCookie) return null;
  const session = verifyToken(tokenCookie.value);
  if (!session) return null;
  if (session.role !== 'HR_ADMIN' && session.role !== 'SYSTEM_ADMIN') return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return Response.json({ success: false, error: 'Keine Berechtigung' }, { status: 403 });
  }

  const users = await db.user.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { createdAt: 'desc' },
  });

  const formattedUsers = users.map((u) => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    roleLabel: ROLE_LABELS[u.role] || u.role,
    modules: JSON.parse((u.modules as string) || '[]'),
    active: u.active,
    onboarded: u.onboarded,
    createdAt: u.createdAt,
  }));

  return Response.json({ success: true, data: formattedUsers, total: formattedUsers.length });
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return Response.json({ success: false, error: 'Keine Berechtigung' }, { status: 403 });
  }

  let body: {
    email?: string;
    firstName?: string;
    lastName?: string;
    role?: Role;
    modules?: string[];
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: 'Ungültige Anfrage' }, { status: 400 });
  }

  if (!body.email || !body.firstName || !body.lastName) {
    return Response.json({ success: false, error: 'Pflichtfelder: email, firstName, lastName' }, { status: 400 });
  }

  const existingUser = await db.user.findFirst({
    where: { tenantId: session.tenantId, email: body.email.toLowerCase().trim() },
  });

  if (existingUser) {
    return Response.json({ success: false, error: 'E-Mail bereits in diesem Mandanten vergeben' }, { status: 409 });
  }

  const temporaryPassword = await hashPassword('changeme123'); // Demo fallback

  const newUser = await db.user.create({
    data: {
      tenantId: session.tenantId,
      email: body.email.toLowerCase().trim(),
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      role: body.role || 'EMPLOYEE',
      modules: JSON.stringify(body.modules || []),
      active: true,
      onboarded: false,
      passwordHash: temporaryPassword,
    },
  });

  const responseUser = {
    ...newUser,
    roleLabel: ROLE_LABELS[newUser.role] || newUser.role,
    modules: JSON.parse((newUser.modules as string) || '[]'),
  };

  return Response.json({ success: true, data: responseUser }, { status: 201 });
}
