/**
 * server/seed.js
 * Seeds the profiles table via Prisma if empty.
 * Called once at server startup from index.js.
 */
import prisma from './prisma.js';

export async function seedProfiles() {
  const count = await prisma.profile.count();
  if (count > 0) return; // already seeded

  await prisma.profile.createMany({
    data: [
      {
        id: 'usr-1',
        username: 'admin',
        password: 'admin123',
        role: 'admin',
        fullName: 'Test Admin',
        badgeNumber: 'ADM-001',
        rank: 'SP',
        stationId: 'hq',
      },
      {
        id: 'usr-2',
        username: 'io_1',
        password: 'io123',
        role: 'io',
        fullName: 'Investigating Officer Singh',
        badgeNumber: 'IO-101',
        rank: 'SI',
        stationId: 'stn-1',
      },
      {
        id: 'usr-3',
        username: 'sho_1',
        password: 'sho123',
        role: 'sho',
        fullName: 'SHO Kumar',
        badgeNumber: 'SHO-201',
        rank: 'Inspector',
        stationId: 'stn-1',
      },
    ],
  });

  console.log('[seed] Profiles seeded via Prisma.');
}
