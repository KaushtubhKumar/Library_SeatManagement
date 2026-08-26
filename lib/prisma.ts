import { PrismaClient } from "@prisma/client";

// Next.js hot-reloads modules in dev, which would otherwise create a
// fresh PrismaClient (and a fresh connection pool) on every file save.
// Stashing the instance on `global` survives the reload.
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
