import { PrismaClient, UserRole, RoomStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/**
 * Seed error class for seed-specific failures
 */
class SeedError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'SeedError';
    Error.captureStackTrace(this, SeedError);
  }
}

/**
 * Seed data configuration with fixed UUIDs for deterministic seeding
 */
const SEED_CONFIG = {
  admin: {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@hotel.com',
    password: 'Admin123!@#',
    role: UserRole.ADMIN,
  },
  rooms: [
    {
      id: '00000000-0000-0000-0000-000000000101',
      roomNumber: '101',
      type: 'Standard',
      price: '99.99',
      status: RoomStatus.AVAILABLE,
    },
    {
      id: '00000000-0000-0000-0000-000000000102',
      roomNumber: '102',
      type: 'Standard',
      price: '99.99',
      status: RoomStatus.AVAILABLE,
    },
    {
      id: '00000000-0000-0000-0000-000000000201',
      roomNumber: '201',
      type: 'Deluxe',
      price: '149.99',
      status: RoomStatus.AVAILABLE,
    },
    {
      id: '00000000-0000-0000-0000-000000000202',
      roomNumber: '202',
      type: 'Deluxe',
      price: '149.99',
      status: RoomStatus.AVAILABLE,
    },
    {
      id: '00000000-0000-0000-0000-000000000301',
      roomNumber: '301',
      type: 'Suite',
      price: '249.99',
      status: RoomStatus.AVAILABLE,
    },
    {
      id: '00000000-0000-0000-0000-000000000302',
      roomNumber: '302',
      type: 'Suite',
      price: '249.99',
      status: RoomStatus.AVAILABLE,
    },
  ],
} as const;

/**
 * Hashes a password using bcrypt with salt rounds
 *
 * @param password - Plain text password to hash
 * @returns Promise resolving to hashed password
 * @throws {SeedError} If password hashing fails
 */
async function hashPassword(password: string): Promise<string> {
  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown hashing error';
    throw new SeedError(`Failed to hash password: ${errorMessage}`, error);
  }
}

/**
 * Seeds the admin user into the database
 * Uses upsert to make the operation idempotent
 *
 * @param prisma - PrismaClient instance
 * @returns Promise resolving when admin user is seeded
 * @throws {SeedError} If admin user seeding fails
 */
async function seedAdminUser(prisma: PrismaClient): Promise<void> {
  try {
    console.log('Seeding admin user...');

    const hashedPassword = await hashPassword(SEED_CONFIG.admin.password);

    const admin = await prisma.user.upsert({
      where: { id: SEED_CONFIG.admin.id },
      update: {
        email: SEED_CONFIG.admin.email,
        password: hashedPassword,
        role: SEED_CONFIG.admin.role,
      },
      create: {
        id: SEED_CONFIG.admin.id,
        email: SEED_CONFIG.admin.email,
        password: hashedPassword,
        role: SEED_CONFIG.admin.role,
      },
    });

    console.log(`✓ Admin user seeded: ${admin.email} (ID: ${admin.id})`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new SeedError(`Failed to seed admin user: ${errorMessage}`, error);
  }
}

/**
 * Seeds room types into the database
 * Uses upsert to make the operation idempotent
 *
 * @param prisma - PrismaClient instance
 * @returns Promise resolving when all rooms are seeded
 * @throws {SeedError} If room seeding fails
 */
async function seedRooms(prisma: PrismaClient): Promise<void> {
  try {
    console.log('Seeding room types...');

    const roomPromises = SEED_CONFIG.rooms.map(async (roomData) => {
      const room = await prisma.room.upsert({
        where: { id: roomData.id },
        update: {
          roomNumber: roomData.roomNumber,
          type: roomData.type,
          price: roomData.price,
          status: roomData.status,
        },
        create: {
          id: roomData.id,
          roomNumber: roomData.roomNumber,
          type: roomData.type,
          price: roomData.price,
          status: roomData.status,
        },
      });

      console.log(
        `  ✓ Room ${room.roomNumber} (${room.type}) seeded - $${room.price}/night`
      );

      return room;
    });

    await Promise.all(roomPromises);

    console.log(`✓ ${SEED_CONFIG.rooms.length} rooms seeded successfully`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new SeedError(`Failed to seed rooms: ${errorMessage}`, error);
  }
}

/**
 * Verifies database connection before seeding
 *
 * @param prisma - PrismaClient instance
 * @returns Promise resolving when connection is verified
 * @throws {SeedError} If database connection fails
 */
async function verifyDatabaseConnection(prisma: PrismaClient): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1 as connection_check`;
    console.log('✓ Database connection verified');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown connection error';
    throw new SeedError(`Database connection failed: ${errorMessage}`, error);
  }
}

/**
 * Main seed function that orchestrates database seeding
 * Implements idempotent seeding with proper error handling and cleanup
 *
 * @returns Promise resolving when seeding is complete
 * @throws {SeedError} If seeding fails at any stage
 *
 * @example
 * ```typescript
 * // Run seed script
 * seed()
 *   .then(() => console.log('Seeding completed'))
 *   .catch((error) => console.error('Seeding failed:', error));
 * ```
 */
async function seed(): Promise<void> {
  const prisma = new PrismaClient({
    log: ['error', 'warn'],
  });

  const startTime = Date.now();

  try {
    console.log('='.repeat(60));
    console.log('Starting database seed...');
    console.log('='.repeat(60));

    // Verify database connection
    await verifyDatabaseConnection(prisma);

    // Seed admin user
    await seedAdminUser(prisma);

    // Seed rooms
    await seedRooms(prisma);

    const duration = Date.now() - startTime;

    console.log('='.repeat(60));
    console.log(`✓ Database seeding completed successfully in ${duration}ms`);
    console.log('='.repeat(60));
    console.log('\nSeeded data summary:');
    console.log(`  - 1 admin user (${SEED_CONFIG.admin.email})`);
    console.log(`  - ${SEED_CONFIG.rooms.length} rooms across 3 types`);
    console.log('    * 2 Standard rooms ($99.99/night)');
    console.log('    * 2 Deluxe rooms ($149.99/night)');
    console.log('    * 2 Suite rooms ($249.99/night)');
    console.log('\nDefault admin credentials:');
    console.log(`  Email: ${SEED_CONFIG.admin.email}`);
    console.log(`  Password: ${SEED_CONFIG.admin.password}`);
    console.log('\n⚠️  IMPORTANT: Change the admin password after first login!');
    console.log('='.repeat(60));
  } catch (error) {
    const duration = Date.now() - startTime;

    console.error('='.repeat(60));
    console.error(`✗ Database seeding failed after ${duration}ms`);
    console.error('='.repeat(60));

    if (error instanceof SeedError) {
      console.error(`Error: ${error.message}`);
      if (error.cause) {
        console.error('Cause:', error.cause);
      }
    } else if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
      console.error('Stack:', error.stack);
    } else {
      console.error('Unknown error:', error);
    }

    console.error('='.repeat(60));

    throw error;
  } finally {
    // Always disconnect from database
    try {
      await prisma.$disconnect();
      console.log('✓ Database connection closed');
    } catch (disconnectError) {
      console.error('Failed to disconnect from database:', disconnectError);
    }
  }
}

/**
 * Execute seed function if running as main module
 */
if (require.main === module) {
  seed()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error during seeding:', error);
      process.exit(1);
    });
}

/**
 * Export seed function as default for programmatic usage
 */
export default seed;

/**
 * Export seed configuration for testing purposes
 */
export { SEED_CONFIG };