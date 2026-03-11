import "./env.js";
import { webcrypto } from "node:crypto";
import { prisma } from "./prisma.js";

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
}

type AdminSeed = {
  email: string;
  password: string;
  name: string;
};

function getAdminSeeds(): AdminSeed[] {
  const seeds = [1, 2].map((index) => {
    const email = process.env[`ADMIN_${index}_EMAIL`]?.trim() ?? "";
    const password = process.env[`ADMIN_${index}_PASSWORD`]?.trim() ?? "";
    const name = process.env[`ADMIN_${index}_NAME`]?.trim() || `Admin ${index}`;

    if (!email && !password) {
      return null;
    }

    if (!email || !password) {
      throw new Error(`ADMIN_${index}_EMAIL and ADMIN_${index}_PASSWORD must both be set`);
    }

    return { email, password, name };
  });

  return seeds.filter((seed): seed is AdminSeed => seed !== null);
}

async function seedAdmins() {
  const adminSeeds = getAdminSeeds();

  if (adminSeeds.length === 0) {
    console.log("No admin credentials configured, skipping admin user seed.");
    return;
  }

  const { auth } = await import("./auth.js");
  const context = await auth.$context;

  for (const admin of adminSeeds) {
    const normalizedEmail = admin.email.toLowerCase();
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    const passwordHash = await context.password.hash(admin.password);

    if (!existingUser) {
      const created = await context.internalAdapter.createUser({
        email: normalizedEmail,
        name: admin.name,
        emailVerified: true,
        role: "admin",
      });

      if (!created) {
        throw new Error(`Failed to create admin user ${normalizedEmail}`);
      }

      await context.internalAdapter.linkAccount({
        userId: created.id,
        providerId: "credential",
        accountId: created.id,
        password: passwordHash,
      });

      console.log(`Created admin user ${normalizedEmail}`);
      continue;
    }

    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        emailVerified: true,
        name: admin.name,
        role: "admin",
      },
    });

    const credentialAccount = (await context.internalAdapter.findAccounts(existingUser.id))
      .find((account) => account.providerId === "credential" && account.password);

    if (credentialAccount) {
      await context.internalAdapter.updatePassword(existingUser.id, passwordHash);
    } else {
      await context.internalAdapter.linkAccount({
        userId: existingUser.id,
        providerId: "credential",
        accountId: existingUser.id,
        password: passwordHash,
      });
    }

    console.log(`Updated admin user ${normalizedEmail}`);
  }
}

async function main() {
  const rules = [
    { code: "ABSENCE", label: "Fravær", crosses: 2, details: "Ikke til stede" },
    { code: "REMOTE", label: "Remote (teller som fravær)", crosses: 2, details: "Remote" },
    { code: "VIDEO", label: "Video (teller som fravær)", crosses: 2, details: "Video" },
    { code: "MM", label: "Mildly moist", crosses: 0.5, details: "Litt søl" },
    { code: "W", label: "W-chug (wet)", crosses: 1, details: "Mer søl" }
  ];

  for (const r of rules) {
    await prisma.rule.upsert({ where: { code: r.code }, update: r, create: r });
  }

  await seedAdmins();
}

main().finally(async () => prisma.$disconnect());
