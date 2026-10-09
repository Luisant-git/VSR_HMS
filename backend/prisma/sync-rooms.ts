import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- STARTING ROOM OCCUPANCY SYNC ---');

  const rooms = await prisma.room.findMany({
    include: { students: true }
  });

  console.log(`Found ${rooms.length} total rooms in database.`);

  let updatedCount = 0;
  for (const room of rooms) {
    const activeCount = room.students ? room.students.filter(s => s.status !== 'Vacated').length : 0;
    await prisma.room.update({
      where: { id: room.id },
      data: { occupiedCount: activeCount }
    });
    if (activeCount > 0) {
      console.log(`Room "${room.id}" (Block ${room.block}): ${activeCount} active students -> OccupiedCount updated to ${activeCount}`);
    }
    updatedCount++;
  }

  console.log(`\n🎉 Completed! Successfully synchronized occupancy for ${updatedCount} rooms.`);
}

main()
  .catch((e) => {
    console.error('Error during room sync:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
