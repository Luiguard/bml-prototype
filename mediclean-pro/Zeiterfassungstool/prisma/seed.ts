import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/auth';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-firma' },
    update: {},
    create: {
      id: 'tenant_001',
      name: 'Demo Firma GmbH',
      slug: 'demo-firma',
    },
  });

  const pwHashAdmin = await hashPassword('admin123');
  const pwHashSuper = await hashPassword('super123');
  const pwHashUser = await hashPassword('user123');

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@firma.at' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@firma.at',
      passwordHash: pwHashAdmin,
      firstName: 'Anna',
      lastName: 'Admin',
      role: 'HR_ADMIN',
      modules: JSON.stringify(['projects', 'schedule', 'geofencing', 'reports']),
      onboarded: true,
    },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'vorgesetzt@firma.at' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'vorgesetzt@firma.at',
      passwordHash: pwHashSuper,
      firstName: 'Viktor',
      lastName: 'Vorgesetzt',
      role: 'SUPERVISOR',
      modules: JSON.stringify(['schedule', 'reports']),
      onboarded: true,
    },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'arbeiter@firma.at' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'arbeiter@firma.at',
      passwordHash: pwHashUser,
      firstName: 'Max',
      lastName: 'Arbeiter',
      role: 'EMPLOYEE',
      modules: JSON.stringify([]),
      onboarded: true,
    },
  });

  console.log('Seeding finished.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
