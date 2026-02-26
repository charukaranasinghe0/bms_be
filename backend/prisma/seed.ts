import { prisma } from "../db/prisma";
import { hashPassword } from "../utils/hash";

async function main(): Promise<void> {
  // Seed roles
  const userRole = await prisma.role.upsert({
    where: { roleName: "USER" },
    update: {},
    create: {
      roleName: "USER",
      description: "Standard user",
    },
  });

  const adminRole = await prisma.role.upsert({
    where: { roleName: "ADMIN" },
    update: {},
    create: {
      roleName: "ADMIN",
      description: "Administrator",
    },
  });

  // Seed admin user
  const adminEmail = "admin@example.com";
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existingAdmin) {
    const adminPasswordHash = await hashPassword("Admin@1234");

    await prisma.user.create({
      data: {
        email: adminEmail,
        username: "admin",
        passwordHash: adminPasswordHash,
        fullName: "Admin",
        contactNumber: null,
        roleId: adminRole.roleId,
        employmentType: "FULL_TIME",
        status: "ACTIVE",
      },
    });
  }

  // Seed normal user
  const userEmail = "user@example.com";
  const existingUser = await prisma.user.findUnique({ where: { email: userEmail } });

  if (!existingUser) {
    const userPasswordHash = await hashPassword("User@1234");

    await prisma.user.create({
      data: {
        email: userEmail,
        username: "user",
        passwordHash: userPasswordHash,
        fullName: "User",
        contactNumber: null,
        roleId: userRole.roleId,
        employmentType: "OTHER",
        status: "ACTIVE",
      },
    });
  }
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Seeding failed", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

