const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Try loading xlsx from multiple potential paths
let XLSX = null;
try {
  XLSX = require('xlsx');
} catch {
  try {
    XLSX = require(path.join(__dirname, '../frontend/node_modules/xlsx'));
  } catch {
    try {
      XLSX = require(path.join(__dirname, 'node_modules/xlsx'));
    } catch {
      XLSX = null;
    }
  }
}

async function exportStudentsWithoutCollege() {
  console.log('========================================================');
  console.log('  VSR HMS - EXPORT STUDENTS WITHOUT COLLEGE TO EXCEL    ');
  console.log('========================================================\n');

  try {
    // 1. Fetch all students with college and room details
    const allStudents = await prisma.student.findMany({
      include: {
        college: true,
        room: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`Total registered students in database: ${allStudents.length}`);

    // 2. Filter students who do NOT have a college assigned
    const studentsWithoutCollege = allStudents.filter((s) => {
      if (!s.collegeId || String(s.collegeId).trim() === '') return true;
      if (!s.college) return true;
      const cName = String(s.college.name || '').trim();
      return cName === '' || cName.toUpperCase() === 'N/A';
    });

    const withCollegeCount = allStudents.length - studentsWithoutCollege.length;
    console.log(`Students with college assigned:         ${withCollegeCount}`);
    console.log(`Students WITHOUT college:               ${studentsWithoutCollege.length}\n`);

    if (studentsWithoutCollege.length === 0) {
      console.log('Great news! All registered students currently have a college assigned.');
      return;
    }

    // 3. Prepare data for Excel
    const rows = studentsWithoutCollege.map((s, index) => {
      const joinDate = s.dateOfJoining
        ? new Date(s.dateOfJoining).toISOString().slice(0, 10)
        : '';
      const regDate = s.createdAt
        ? new Date(s.createdAt).toISOString().slice(0, 10)
        : '';
      const dobStr = s.dob
        ? new Date(s.dob).toISOString().slice(0, 10)
        : '';

      const roomStr = s.roomNo ? `Room ${s.roomNo}` : 'NOT ALLOCATED';
      const bedStr = s.bedNo ? s.bedNo : 'NOT ALLOCATED';

      return {
        'S.No': index + 1,
        'Student Name': s.name || '',
        'Registration No': s.regNo || '',
        'Manual Reg / ID': s.manualRegsiName || '',
        'Mobile Number': s.mobileNo || '',
        'College Status': 'NOT ASSIGNED',
        'Room No': roomStr,
        'Bed No': bedStr,
        'Education / Course': s.educationalQua || '',
        'Food Type': s.foodType || 'N/A',
        'Gender': s.gender || 'N/A',
        'Date of Joining': joinDate,
        'Student Status': s.status || 'Active',
        'Father Name': s.fatherName || '',
        'Father Mobile': s.fatherMobileNo || '',
        'Mother Name': s.motherName || '',
        'Mother Mobile': s.motherMobileNo || '',
        'Guardian Name': s.guardianName || '',
        'Guardian Mobile': s.guardianMobileNo || '',
        'Aadhar No': s.aadharNo || '',
        'Email ID': s.emailId || '',
        'Date of Birth': dobStr,
        'Registered On': regDate,
      };
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outputDir = path.resolve(__dirname, 'exports');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const excelFileName = `students_without_college_${timestamp}.xlsx`;
    const excelLatestName = `students_without_college_latest.xlsx`;
    const excelPath = path.join(outputDir, excelFileName);
    const excelLatestPath = path.join(outputDir, excelLatestName);

    const csvFileName = `students_without_college_${timestamp}.csv`;
    const csvLatestName = `students_without_college_latest.csv`;
    const csvPath = path.join(outputDir, csvFileName);
    const csvLatestPath = path.join(outputDir, csvLatestName);

    // 4. Generate Excel (.xlsx) if XLSX library is available
    if (XLSX) {
      const worksheet = XLSX.utils.json_to_sheet(rows);

      // Auto-fit column widths
      const colWidths = Object.keys(rows[0] || {}).map((key) => {
        const headerLen = key.length;
        const maxValLen = rows.reduce(
          (max, r) => Math.max(max, String(r[key] || '').length),
          headerLen
        );
        return { wch: Math.min(Math.max(maxValLen + 3, 10), 40) };
      });
      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Without College');

      XLSX.writeFile(workbook, excelPath);
      XLSX.writeFile(workbook, excelLatestPath);

      console.log(`[SUCCESS] Excel file generated:`);
      console.log(`  -> ${excelPath}`);
      console.log(`  -> ${excelLatestPath}`);
    } else {
      console.log('[INFO] XLSX module not found; generating CSV format (fully compatible with Excel).');
    }

    // 5. Always also generate UTF-8 BOM CSV (guaranteed to open in Microsoft Excel without dependencies)
    const headers = Object.keys(rows[0]);
    const escapeCsv = (val) => {
      const str = String(val === null || val === undefined ? '' : val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent =
      '\uFEFF' +
      headers.map(escapeCsv).join(',') +
      '\n' +
      rows
        .map((row) => headers.map((h) => escapeCsv(row[h])).join(','))
        .join('\n');

    fs.writeFileSync(csvPath, csvContent, 'utf8');
    fs.writeFileSync(csvLatestPath, csvContent, 'utf8');

    console.log(`[SUCCESS] CSV file generated (Excel-compatible):`);
    console.log(`  -> ${csvPath}`);
    console.log(`  -> ${csvLatestPath}\n`);

    // 6. Print preview
    console.log('--- PREVIEW (First 10 students without college) ---');
    console.table(
      studentsWithoutCollege.slice(0, 10).map((s, idx) => ({
        '#': idx + 1,
        Name: s.name,
        RegNo: s.regNo,
        ManualID: s.manualRegsiName || '-',
        Mobile: s.mobileNo || '-',
        Room: s.roomNo || 'None',
        RegisteredOn: s.createdAt ? new Date(s.createdAt).toISOString().slice(0, 10) : '-'
      }))
    );
    console.log('---------------------------------------------------\n');
    console.log(`Total ${studentsWithoutCollege.length} students without college exported successfully.`);

  } catch (error) {
    console.error('[ERROR] Failed to export students without college:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

exportStudentsWithoutCollege();
