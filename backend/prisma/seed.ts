import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const tableData = [
  { room: 'Room A1', loc: 'Block A', type: '5 sharing', cap: '5 Beds', occ: 5, vac: 0, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '5 Students' },
  { room: 'Room A2', loc: 'Block A', type: '5 sharing', cap: '5 Beds', occ: 5, vac: 0, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '5 Students' },
  { room: 'Room A3', loc: 'Block A', type: '5 sharing', cap: '5 Beds', occ: 5, vac: 0, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '5 Students' },
  { room: 'Room A4', loc: 'Block A', type: '5 sharing', cap: '5 Beds', occ: 5, vac: 0, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '5 Students' },
  { room: 'Room A5', loc: 'Block A', type: '5 sharing', cap: '5 Beds', occ: 5, vac: 0, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '5 Students' },
  { room: 'Room A6', loc: 'Block A', type: '5 sharing', cap: '5 Beds', occ: 5, vac: 0, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '5 Students' },
  { room: 'Room A7', loc: 'Block A', type: '5 sharing', cap: '5 Beds', occ: 5, vac: 0, rent: 6500, mess: 3500, tot: 10000, amen: 'AC Attached Bath', live: '5 Students' },
  { room: 'Room A8', loc: 'Block A', type: '5 sharing', cap: '5 Beds', occ: 5, vac: 0, rent: 6500, mess: 3500, tot: 10000, amen: 'AC Attached Bath', live: '5 Students' },
  { room: 'Room A9', loc: 'Block A', type: '5 sharing', cap: '5 Beds', occ: 5, vac: 0, rent: 6500, mess: 3500, tot: 10000, amen: 'AC Attached Bath', live: '5 Students' },
  { room: 'Room A10', loc: 'Block A', type: '5 sharing', cap: '5 Beds', occ: 5, vac: 0, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '5 Students' },
  { room: 'Room A11', loc: 'Block A', type: '5 sharing', cap: '5 Beds', occ: 5, vac: 0, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '5 Students' },
  { room: 'Room A12', loc: 'Block A', type: '5 sharing', cap: '5 Beds', occ: 5, vac: 0, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '5 Students' },
  { room: 'Room B1', loc: 'Block B', type: '6 sharing', cap: '6 Beds', occ: 0, vac: 6, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: 'None (Vacant)' },
  { room: 'Room B2', loc: 'Block B', type: '6 sharing', cap: '6 Beds', occ: 0, vac: 6, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: 'None (Vacant)' },
  { room: 'Room B3', loc: 'Block B', type: '6 sharing', cap: '6 Beds', occ: 0, vac: 6, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: 'None (Vacant)' },
  { room: 'Room B4', loc: 'Block B', type: '6 sharing', cap: '6 Beds', occ: 0, vac: 6, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: 'None (Vacant)' },
  { room: 'Room B5', loc: 'Block B', type: '6 sharing', cap: '6 Beds', occ: 0, vac: 6, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: 'None (Vacant)' },
  { room: 'Room B6', loc: 'Block B', type: '6 sharing', cap: '6 Beds', occ: 0, vac: 6, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: 'None (Vacant)' },
  { room: 'Room B7', loc: 'Block B', type: '6 sharing', cap: '6 Beds', occ: 0, vac: 6, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: 'None (Vacant)' },
  { room: 'Room B8', loc: 'Block B', type: '6 sharing', cap: '6 Beds', occ: 0, vac: 6, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: 'None (Vacant)' },
  { room: 'Room B9', loc: 'Block B', type: '6 sharing', cap: '6 Beds', occ: 0, vac: 6, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: 'None (Vacant)' },
  { room: 'Room B10', loc: 'Block B', type: '6 sharing', cap: '6 Beds', occ: 0, vac: 6, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: 'None (Vacant)' },
  { room: 'Room B11', loc: 'Block B', type: '6 sharing', cap: '6 Beds', occ: 0, vac: 6, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: 'None (Vacant)' },
  { room: 'Room B12', loc: 'Block B', type: '6 sharing', cap: '6 Beds', occ: 0, vac: 6, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: 'None (Vacant)' },
  { room: 'Room C1', loc: 'Block C', type: '5 sharing', cap: '5 Beds', occ: 2, vac: 3, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '2 Students' },
  { room: 'Room C2', loc: 'Block C', type: '5 sharing', cap: '5 Beds', occ: 2, vac: 3, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '2 Students' },
  { room: 'Room C3', loc: 'Block C', type: '5 sharing', cap: '5 Beds', occ: 2, vac: 3, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '2 Students' },
  { room: 'Room C4', loc: 'Block C', type: '5 sharing', cap: '5 Beds', occ: 2, vac: 3, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '2 Students' },
  { room: 'Room C5', loc: 'Block C', type: '5 sharing', cap: '5 Beds', occ: 2, vac: 3, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '2 Students' },
  { room: 'Room C6', loc: 'Block C', type: '5 sharing', cap: '5 Beds', occ: 2, vac: 3, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '2 Students' },
  { room: 'Room C7', loc: 'Block C', type: '5 sharing', cap: '5 Beds', occ: 2, vac: 3, rent: 6500, mess: 3500, tot: 10000, amen: 'AC Attached Bath', live: '2 Students' },
  { room: 'Room C8', loc: 'Block C', type: '5 sharing', cap: '5 Beds', occ: 2, vac: 3, rent: 6500, mess: 3500, tot: 10000, amen: 'AC Attached Bath', live: '2 Students' },
  { room: 'Room C9', loc: 'Block C', type: '5 sharing', cap: '5 Beds', occ: 2, vac: 3, rent: 6500, mess: 3500, tot: 10000, amen: 'AC Attached Bath', live: '2 Students' },
  { room: 'Room C10', loc: 'Block C', type: '5 sharing', cap: '5 Beds', occ: 2, vac: 3, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '2 Students' },
  { room: 'Room C11', loc: 'Block C', type: '5 sharing', cap: '5 Beds', occ: 2, vac: 3, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '2 Students' },
  { room: 'Room C12', loc: 'Block C', type: '5 sharing', cap: '5 Beds', occ: 2, vac: 3, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: '2 Students' },
  { room: 'Room D1', loc: 'Block D', type: '6 sharing', cap: '6 Beds', occ: 6, vac: 0, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: '6 Students' },
  { room: 'Room D2', loc: 'Block D', type: '6 sharing', cap: '6 Beds', occ: 6, vac: 0, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: '6 Students' },
  { room: 'Room D3', loc: 'Block D', type: '6 sharing', cap: '6 Beds', occ: 6, vac: 0, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: '6 Students' },
  { room: 'Room D4', loc: 'Block D', type: '6 sharing', cap: '6 Beds', occ: 6, vac: 0, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: '6 Students' },
  { room: 'Room D5', loc: 'Block D', type: '6 sharing', cap: '6 Beds', occ: 6, vac: 0, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: '6 Students' },
  { room: 'Room D6', loc: 'Block D', type: '6 sharing', cap: '6 Beds', occ: 6, vac: 0, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: '6 Students' },
  { room: 'Room D7', loc: 'Block D', type: '6 sharing', cap: '6 Beds', occ: 6, vac: 0, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: '6 Students' },
  { room: 'Room D8', loc: 'Block D', type: '6 sharing', cap: '6 Beds', occ: 6, vac: 0, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: '6 Students' },
  { room: 'Room D9', loc: 'Block D', type: '6 sharing', cap: '6 Beds', occ: 6, vac: 0, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: '6 Students' },
  { room: 'Room D10', loc: 'Block D', type: '6 sharing', cap: '6 Beds', occ: 6, vac: 0, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: '6 Students' },
  { room: 'Room D11', loc: 'Block D', type: '6 sharing', cap: '6 Beds', occ: 6, vac: 0, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: '6 Students' },
  { room: 'Room D12', loc: 'Block D', type: '6 sharing', cap: '6 Beds', occ: 6, vac: 0, rent: 4000, mess: 3500, tot: 7500, amen: 'Attached Bath', live: '6 Students' },
  { room: 'Room E1', loc: 'Block E', type: 'single', cap: '1 Beds', occ: 1, vac: 0, rent: 0, mess: 0, tot: 0, amen: 'AC Attached Bath', live: 'Warden' },
  { room: 'Room E2', loc: 'Block E', type: '5 sharing', cap: '5 Beds', occ: 0, vac: 5, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: 'None (Vacant)' },
  { room: 'Room E3', loc: 'Block E', type: '5 sharing', cap: '5 Beds', occ: 0, vac: 5, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: 'None (Vacant)' },
  { room: 'Room E4', loc: 'Block E', type: '5 sharing', cap: '5 Beds', occ: 0, vac: 5, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: 'None (Vacant)' },
  { room: 'Room E5', loc: 'Block E', type: '5 sharing', cap: '5 Beds', occ: 0, vac: 5, rent: 4500, mess: 3500, tot: 8000, amen: 'Attached Bath', live: 'None (Vacant)' },
  { room: 'Room W1', loc: 'Single Rooms', type: 'single', cap: '1 Beds', occ: 1, vac: 0, rent: 8500, mess: 3500, tot: 12000, amen: 'AC Attached Bath', live: '1 Student' },
  { room: 'Room W2', loc: 'Single Rooms', type: 'single', cap: '1 Beds', occ: 1, vac: 0, rent: 8500, mess: 3500, tot: 12000, amen: 'AC Attached Bath', live: '1 Student' },
  { room: 'Room W3', loc: 'Single Rooms', type: 'single', cap: '1 Beds', occ: 1, vac: 0, rent: 8500, mess: 3500, tot: 12000, amen: 'AC Attached Bath', live: '1 Student' },
  { room: 'Dorm', loc: 'Dormitory', type: 'dormitory', cap: '28 Beds', occ: 10, vac: 18, rent: 3000, mess: 3500, tot: 6500, amen: 'None', live: '10 Students' }
];

async function main() {
  console.log('Seeding rooms...');

  for (const item of tableData) {
    const id = item.room.replace('Room ', ''); // e.g. A1, Dorm
    const capacity = parseInt(item.cap.replace(' Beds', ''), 10);
    
    // We will upsert so we don't break existing data or crash if it exists
    await prisma.room.upsert({
      where: { id },
      update: {
        block: item.loc,
        capacity,
        type: item.type,
        rent: item.rent,
        messFee: item.mess,
        amenities: item.amen !== 'None' ? item.amen : null,
        // we leave occupiedCount alone during update to not override real data
      },
      create: {
        id,
        block: item.loc,
        floor: 1, // default
        capacity,
        type: item.type,
        rent: item.rent,
        messFee: item.mess,
        amenities: item.amen !== 'None' ? item.amen : null,
        occupiedCount: 0 // real students will increment this
      }
    });
  }

  console.log('Room seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
