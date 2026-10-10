const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function exportNotUpdatedStudents() {
  console.log('Fetching students who have not updated their profiles...');
  
  try {
    const students = await prisma.student.findMany({
      where: {
        profileUpdatedAt: null
      },
      include: {
        college: true,
        room: true
      }
    });

    if (students.length === 0) {
      console.log('All students have updated their profiles!');
      return;
    }

    console.log(`Found ${students.length} students. Generating CSV...`);

    // Define CSV Headers
    const headers = [
      'Registration No',
      'Name',
      'Gender',
      'Mobile No',
      'College',
      'Course',
      'Room No',
      'Date of Joining',
      'Status'
    ];

    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '';
      const stringified = String(str);
      if (stringified.includes(',') || stringified.includes('"') || stringified.includes('\n')) {
        return `"${stringified.replace(/"/g, '""')}"`;
      }
      return stringified;
    };

    // Generate CSV Rows
    const rows = students.map(s => {
      return [
        escapeCsv(s.manualRegsiName || s.regNo),
        escapeCsv(s.name),
        escapeCsv(s.gender),
        escapeCsv(s.mobileNo),
        escapeCsv(s.college?.name || s.collegeId),
        escapeCsv(s.educationalQua),
        escapeCsv(s.room?.roomNumber || s.roomId),
        escapeCsv(s.dateOfJoining ? s.dateOfJoining.toISOString().split('T')[0] : ''),
        escapeCsv(s.status)
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    fs.writeFileSync('NotUpdatedStudents.csv', csvContent);
    console.log('Successfully generated NotUpdatedStudents.csv in the backend folder!');

  } catch (error) {
    console.error('Error generating export:', error);
  } finally {
    await prisma.$disconnect();
  }
}

exportNotUpdatedStudents();
