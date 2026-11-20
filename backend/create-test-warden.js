/**
 * Creates ONE local test warden record so the Hostellers page theme/count
 * behaviour can be checked without touching production data.
 *
 * Run from the backend folder (uses backend/.env -> DATABASE_URL):
 *
 *   node create-test-warden.js
 *   node create-test-warden.js --delete   // remove the test data again
 *
 * Safe to re-run: it upserts by the fixed registration number.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const WARDEN = {
  studentId: 'test-warden-local',
  regNo: 'ASEASIND26348',
  name: 'SELVI WARDERN',
  mobileNo: '7373556602',
  educationalQua: 'SE',
  roomId: 'E1',
};

async function main() {
  const deleting = process.argv.includes('--delete');

  if (deleting) {
    await prisma.student.deleteMany({ where: { regNo: WARDEN.regNo } });
    await prisma.room.deleteMany({ where: { id: WARDEN.roomId, block: 'Block E' } });
    console.log('Local test warden removed.');
    return;
  }

  await prisma.room.upsert({
    where: { id: WARDEN.roomId },
    update: { block: 'Block E', type: 'Single', capacity: 1, occupiedCount: 1, rent: 0, messFee: 0 },
    create: {
      id: WARDEN.roomId,
      block: 'Block E',
      floor: 1,
      type: 'Single',
      capacity: 1,
      occupiedCount: 1,
      rent: 0,
      messFee: 0,
      amenities: 'AC, Attached Bath',
    },
  });

  await prisma.student.upsert({
    where: { regNo: WARDEN.regNo },
    update: {
      name: WARDEN.name,
      mobileNo: WARDEN.mobileNo,
      educationalQua: WARDEN.educationalQua,
      roomNo: WARDEN.roomId,
      status: 'In',
    },
    create: {
      id: WARDEN.studentId,
      regNo: WARDEN.regNo,
      name: WARDEN.name,
      mobileNo: WARDEN.mobileNo,
      educationalQua: WARDEN.educationalQua,
      roomNo: WARDEN.roomId,
      status: 'In',
      dateOfJoining: new Date('2026-11-01T00:00:00.000Z'),
    },
  });

  console.log('Local test warden ready:');
  console.log(`  Reg: ${WARDEN.regNo}`);
  console.log(`  Name: ${WARDEN.name}`);
  console.log(`  Mobile: ${WARDEN.mobileNo}`);
  console.log(`  Room: ${WARDEN.roomId}`);
  console.log('Open the Hostellers page to see the amber WARDEN row.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
