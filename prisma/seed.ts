import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import path from 'path';

// Get database file path - matches what prisma.config.ts uses
const dbUrl = process.env.DATABASE_URL || 'file:./dev.db';
const dbPath = dbUrl.replace('file:', '').replace('./', '');
// Database is in the root of the project, not in prisma folder
const absoluteDbPath = path.join(process.cwd(), dbPath);

console.log('Database path:', absoluteDbPath);

// Create adapter with URL config
const adapter = new PrismaBetterSqlite3({ url: absoluteDbPath });

// Create Prisma client with adapter
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // Create default admin user
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@syncengine.local';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Administrator',
        role: 'admin',
        status: 'approved', // Admin is pre-approved
        isActive: true,
        approvedAt: new Date(),
        loginCount: 0,
      },
    });

    console.log(`Created admin user: ${admin.email}`);
    console.log('Note: Admin will authenticate via OTP email');
  } else {
    console.log(`Admin user already exists: ${existingAdmin.email}`);
    
    // Update existing admin to new schema if needed
    if (!existingAdmin.status || existingAdmin.status === 'pending') {
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          status: 'approved',
          approvedAt: new Date(),
        },
      });
      console.log('Updated admin to approved status');
    }
  }

  // Create a demo supervisor user
  const supervisorEmail = 'supervisor@syncengine.local';
  const existingSupervisor = await prisma.user.findUnique({
    where: { email: supervisorEmail },
  });

  if (!existingSupervisor) {
    const supervisor = await prisma.user.create({
      data: {
        email: supervisorEmail,
        name: 'Demo Supervisor',
        role: 'supervisor',
        status: 'approved',
        isActive: true,
        approvedAt: new Date(),
        loginCount: 0,
      },
    });

    console.log(`Created supervisor user: ${supervisor.email}`);
  }

  // Create default settings
  const defaultSettings = [
    { key: 'app_name', value: 'SyncEngine', description: 'Application name' },
    { key: 'timezone', value: 'UTC', description: 'Default timezone' },
    { key: 'default_output_path', value: './output', description: 'Default output path for sync files' },
    { key: 'default_row_limit', value: '100000', description: 'Default row limit per table' },
    { key: 'audit_retention_days', value: '90', description: 'Audit log retention in days' },
    { key: 'file_retention_days', value: '30', description: 'Sync file retention in days' },
    { key: 'session_timeout_minutes', value: '120', description: 'Session timeout in minutes' },
    { key: 'otp_expiry_minutes', value: '10', description: 'OTP code expiry in minutes' },
  ];

  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  console.log('Created default settings');

  // Create sample data source (for demo purposes)
  const demoDataSource = await prisma.dataSource.upsert({
    where: { id: 'demo-source' },
    update: {},
    create: {
      id: 'demo-source',
      name: 'Demo PostgreSQL',
      description: 'Sample PostgreSQL database for demonstration',
      dbType: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: 'demo_db',
      username: 'demo_user',
      password: 'demo_password', // In production, this would be encrypted
      sslEnabled: false,
      isActive: true,
      connectionStatus: 'untested',
    },
  });

  console.log(`Created demo data source: ${demoDataSource.name}`);

  // Log seed completion
  await prisma.auditLog.create({
    data: {
      eventType: 'system_seeded',
      eventDetails: JSON.stringify({
        adminEmail,
        supervisorEmail,
        timestamp: new Date().toISOString(),
      }),
    },
  });

  console.log('');
  console.log('='.repeat(60));
  console.log('Database seeding completed!');
  console.log('='.repeat(60));
  console.log('');
  console.log('Default users created:');
  console.log(`  Admin:      ${adminEmail}`);
  console.log(`  Supervisor: ${supervisorEmail}`);
  console.log('');
  console.log('Authentication: OTP via email');
  console.log('Note: Configure SMTP in Settings to enable email delivery.');
  console.log('      Without SMTP, OTP codes will be logged to console.');
  console.log('='.repeat(60));
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
