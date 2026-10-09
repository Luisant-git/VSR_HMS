import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=====================================================');
  console.log('  HMS PRODUCTION CLEANUP: RESET SECONDARY FIELDS');
  console.log('=====================================================\n');

  // Find all students
  const students = await prisma.student.findMany({
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Found ${students.length} total student records in database.`);

  if (students.length === 0) {
    console.log('No students found. Exiting.');
    return;
  }

  console.log('\nCleaning mismatched secondary fields (fatherName, address, aadharNo, dob, etc.)...');
  console.log('Retaining core fields (id, regNo, name, manualRegsiName, mobileNo, photoUrl, roomNo, bedNo, status, feeStatus)...');

  let updatedCount = 0;

  for (const student of students) {
    await prisma.student.update({
      where: { id: student.id },
      data: {
        fatherName: null,
        fatherMobileNo: null,
        motherName: null,
        motherMobileNo: null,
        guardianName: null,
        guardianMobileNo: null,
        emergencyContact: null,
        address: null,
        aadharNo: null,
        secondaryIdNo: null,
        dob: null,
        age: null,
        dateOfJoining: null,
        educationalQua: null,
        courseDuration: null,
        category: null,
        maritalStatus: null,
        foodType: null,
        collegeId: null,
        pursuingYear: null,
        passingYear: null,
        vsrLedger1: null,
        biometricId: null,
        emailId: null,
        bloodGroup: null,
        doc1Url: null,
        doc2Url: null,
        doc1Type: null,
        doc2Type: null,
        doc1Number: null,
        doc2Number: null,
      }
    });
    updatedCount++;
  }

  console.log(`\n🎉 SUCCESS! Successfully cleaned secondary fields for ${updatedCount} students.`);
  console.log('\nNext Step: Log into your Hostel Management System web interface and re-import your student Excel sheet.');
  console.log('The system will match each student by Name & Mobile / Manual Reg Name and populate exact accurate details!');
}

main()
  .catch((e) => {
    console.error('Error during cleanup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
