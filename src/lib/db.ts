import { PrismaClient } from '@/generated/prisma';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';

// Get database file path - matches what prisma.config.ts uses
const dbUrl = process.env.DATABASE_URL || 'file:./dev.db';
const dbPath = dbUrl.replace('file:', '').replace('./', '');
// Database is in the root of the project, not in prisma folder
const absoluteDbPath = path.join(process.cwd(), dbPath);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  // Create adapter with URL config
  const adapter = new PrismaBetterSqlite3({ url: absoluteDbPath });
  
  // Create Prisma client with adapter
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
