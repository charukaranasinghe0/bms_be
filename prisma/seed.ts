import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

async function main() {
  const passwordHash = await bcrypt.hash('admin123', SALT_ROUNDS);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      password: passwordHash,
      role: 'ADMIN',
    },
    create: {
      username: 'admin',
      password: passwordHash,
      role: 'ADMIN',
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

