const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanBadData() {
  console.log('--- STARTING DB CLEANUP ---');

  // 1. Find and delete fake colleges created from student names
  const allColleges = await prisma.college.findMany();
  const fakeColleges = allColleges.filter(c => {
    const n = c.name.trim();
    // Student names usually have dots like Harini.S, Vidhya Bharathi.K, or match known invalid patterns
    return (
      /\.[A-Za-z]$/.test(n) || // ends with .S, .K, .J, .R, .C, .V, .N, .M, .P, .A, .G
      n.toLowerCase().includes('catharin') ||
      n.toLowerCase().includes('harini') ||
      n.toLowerCase().includes('vidhya') ||
      n.toLowerCase().includes('miruthula') ||
      n.toLowerCase().includes('dharshana') ||
      n.toLowerCase().includes('kaviya') ||
      n.toLowerCase().includes('keesavanthi') ||
      n.toLowerCase().includes('sushmitha') ||
      n.toLowerCase().includes('mercy') ||
      n.toLowerCase().includes('akshaya') ||
      n.toLowerCase().includes('ragavi') ||
      n.toLowerCase().includes('bavatharani') ||
      n.toLowerCase() === 'ass engineer'
    );
  });

  console.log(`Found ${fakeColleges.length} fake college entries:`);
  fakeColleges.forEach(fc => console.log(` - ID: ${fc.id} | Name: "${fc.name}"`));

  for (const fc of fakeColleges) {
    // Unlink any students linked to this fake college
    await prisma.student.updateMany({
      where: { collegeId: fc.id },
      data: { collegeId: null }
    });
    // Delete fake college
    await prisma.college.delete({
      where: { id: fc.id }
    });
  }
  console.log('✓ Successfully deleted fake colleges and unlinked students.');

  // 2. Fix students with roomNo set to a person name
  const badRoomStudents = await prisma.student.findMany({
    where: {
      roomNo: { not: null }
    }
  });

  const studentsToFixRoom = badRoomStudents.filter(s => {
    if (!s.roomNo) return false;
    const r = s.roomNo.trim();
    return (
      r.length > 12 ||
      /\.[A-Za-z]$/.test(r) ||
      r.toUpperCase().includes('CATHARINE') ||
      r.toUpperCase().includes('BERSHIYA') ||
      /^[A-Za-z\s.]{10,}$/.test(r)
    );
  });

  console.log(`Found ${studentsToFixRoom.length} students with invalid room numbers:`);
  studentsToFixRoom.forEach(s => console.log(` - ID: ${s.id} | Name: "${s.name}" | Bad RoomNo: "${s.roomNo}"`));

  for (const s of studentsToFixRoom) {
    await prisma.student.update({
      where: { id: s.id },
      data: { roomNo: null }
    });
  }
  console.log('✓ Successfully fixed invalid student room numbers.');
}

cleanBadData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
