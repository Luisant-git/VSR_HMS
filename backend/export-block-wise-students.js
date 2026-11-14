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

// Natural sort for room numbers (e.g. A1, A2, ... A9, A10, A11, A12)
function naturalSort(a, b) {
  return String(a || '').localeCompare(String(b || ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

// Block normalizer to ensure consistent block naming
function normalizeBlock(rawBlock, roomNo) {
  if (!rawBlock && !roomNo) return 'Unallocated';
  let b = String(rawBlock || '').trim();

  if (b === 'E' || b.toUpperCase() === 'BLOCK E' || (roomNo && /^E\d+/i.test(roomNo))) {
    return 'Block E';
  }
  if (b.toUpperCase() === 'BLOCK A' || (roomNo && /^A\d+/i.test(roomNo))) {
    return 'Block A';
  }
  if (b.toUpperCase() === 'BLOCK B' || (roomNo && /^B\d+/i.test(roomNo))) {
    return 'Block B';
  }
  if (b.toUpperCase() === 'BLOCK C' || (roomNo && /^C\d+/i.test(roomNo))) {
    return 'Block C';
  }
  if (b.toUpperCase() === 'BLOCK D' || (roomNo && /^D\d+/i.test(roomNo))) {
    return 'Block D';
  }
  if (b.toLowerCase().includes('dorm') || (roomNo && /^dorm/i.test(roomNo))) {
    return 'Dormitory';
  }
  if (b.toLowerCase().includes('single') || (roomNo && /^W\d+/i.test(roomNo))) {
    return 'Single Rooms';
  }

  return b || 'Other';
}

function formatDate(date) {
  if (!date) return '';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

// Format student object into report row
function formatStudentRow(s, index, fallbackBlock) {
  const block = s.room ? normalizeBlock(s.room.block, s.roomNo) : (fallbackBlock || 'Unallocated');
  const collegeName = s.college?.name || s.college?.shortName || '';
  const roomStr = s.roomNo ? s.roomNo : 'NOT ALLOCATED';
  const bedStr = s.bedNo ? s.bedNo : '-';
  const floorVal = s.room?.floor !== undefined && s.room?.floor !== null ? s.room.floor : '-';
  const rentVal = s.rent !== null && s.rent !== undefined ? Number(s.rent) : (s.room?.rent ? Number(s.room.rent) : 0);

  return {
    'S.No': index + 1,
    'Block': block,
    'Room No': roomStr,
    'Bed No': bedStr,
    'Floor': floorVal,
    'Student Name': s.name || '',
    'Reg No': s.regNo || '',
    'Manual / Roll ID': s.manualRegsiName || '',
    'Mobile Number': s.mobileNo || '',
    'Status': s.status || 'Active',
    'College / Institution': collegeName,
    'Degree / Course': s.educationalQua || '',
    'Year': s.pursuingYear || '',
    'Food Preference': s.foodType || 'N/A',
    'Monthly Rent (₹)': rentVal,
    'Fee Status': s.feeStatus || 'Un-Paid',
    'Date of Joining': formatDate(s.dateOfJoining),
    'Father Name': s.fatherName || '',
    'Father Mobile': s.fatherMobileNo || '',
    'Mother Name': s.motherName || '',
    'Mother Mobile': s.motherMobileNo || '',
    'Guardian Name': s.guardianName || '',
    'Guardian Mobile': s.guardianMobileNo || '',
    'Emergency Contact': s.emergencyContact || '',
    'Gender': s.gender || '',
    'Blood Group': s.bloodGroup || '',
    'Aadhar Number': s.aadharNo || '',
    'Email ID': s.emailId || '',
  };
}

// Compute auto-fit column widths for a worksheet
function autoFitColumns(rows) {
  if (!rows || rows.length === 0) return [];
  const keys = Object.keys(rows[0]);
  return keys.map((key) => {
    let maxLen = key.length;
    for (const r of rows) {
      const valStr = r[key] !== null && r[key] !== undefined ? String(r[key]) : '';
      if (valStr.length > maxLen) {
        maxLen = valStr.length;
      }
    }
    return { wch: Math.min(Math.max(maxLen + 3, 10), 45) };
  });
}

async function exportBlockWiseStudents() {
  console.log('===============================================================');
  console.log('      VSR HOSTEL MANAGEMENT SYSTEM - BLOCK-WISE STUDENT EXPORT ');
  console.log('===============================================================\n');

  try {
    // 1. Fetch all rooms with student and college details
    const allRooms = await prisma.room.findMany({
      include: {
        students: {
          include: {
            college: true,
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
    });

    // 2. Fetch all students with college and room details
    const allStudents = await prisma.student.findMany({
      include: {
        room: true,
        college: true,
      },
      orderBy: [
        { roomNo: 'asc' },
        { name: 'asc' },
      ],
    });

    console.log(`✓ Total rooms in database:    ${allRooms.length}`);
    console.log(`✓ Total students in database: ${allStudents.length}\n`);

    // Normalize block on rooms
    allRooms.forEach((r) => {
      r.normalizedBlock = normalizeBlock(r.block, r.id);
    });

    // Group rooms by normalized block
    const blockOrder = [
      'Block A',
      'Block B',
      'Block C',
      'Block D',
      'Block E',
      'Single Rooms',
      'Dormitory',
    ];

    const blockRoomsMap = new Map();
    blockOrder.forEach((b) => blockRoomsMap.set(b, []));

    for (const r of allRooms) {
      const b = r.normalizedBlock;
      if (!blockRoomsMap.has(b)) {
        blockRoomsMap.set(b, []);
      }
      blockRoomsMap.get(b).push(r);
    }

    // Sort rooms naturally inside each block
    for (const [b, rList] of blockRoomsMap.entries()) {
      rList.sort((r1, r2) => naturalSort(r1.id, r2.id));
    }

    // Group students by block
    const blockStudentsMap = new Map();
    blockOrder.forEach((b) => blockStudentsMap.set(b, []));
    blockStudentsMap.set('Unallocated', []);

    const allocatedStudents = [];
    const unallocatedStudents = [];

    for (const s of allStudents) {
      if (!s.roomNo || !s.room) {
        unallocatedStudents.push(s);
        blockStudentsMap.get('Unallocated').push(s);
      } else {
        allocatedStudents.push(s);
        const b = normalizeBlock(s.room.block, s.roomNo);
        if (!blockStudentsMap.has(b)) {
          blockStudentsMap.set(b, []);
        }
        blockStudentsMap.get(b).push(s);
      }
    }

    // Sort students inside each block naturally by room then name
    for (const [b, sList] of blockStudentsMap.entries()) {
      sList.sort((s1, s2) => {
        const roomCmp = naturalSort(s1.roomNo || '', s2.roomNo || '');
        if (roomCmp !== 0) return roomCmp;
        return (s1.name || '').localeCompare(s2.name || '');
      });
    }

    // Sort allStudents master list by Block -> Room -> Student Name
    const allStudentsSorted = [...allStudents].sort((s1, s2) => {
      const b1 = s1.room ? normalizeBlock(s1.room.block, s1.roomNo) : 'ZZZ_Unallocated';
      const b2 = s2.room ? normalizeBlock(s2.room.block, s2.roomNo) : 'ZZZ_Unallocated';
      const bCmp = b1.localeCompare(b2);
      if (bCmp !== 0) return bCmp;

      const roomCmp = naturalSort(s1.roomNo || '', s2.roomNo || '');
      if (roomCmp !== 0) return roomCmp;

      return (s1.name || '').localeCompare(s2.name || '');
    });

    // -------------------------------------------------------------
    // SHEET 1: BLOCK SUMMARY / DASHBOARD
    // -------------------------------------------------------------
    const summaryRows = [];
    let grandRooms = 0;
    let grandCapacity = 0;
    let grandOccupied = 0;
    let grandVacant = 0;
    let grandActiveStudents = 0;
    let grandVacatedStudents = 0;
    let grandTotalStudents = 0;
    let grandMonthlyRent = 0;

    for (const b of blockOrder) {
      const rList = blockRoomsMap.get(b) || [];
      const sList = blockStudentsMap.get(b) || [];

      const totalRooms = rList.length;
      const totalCapacity = rList.reduce((acc, r) => acc + (r.capacity || 0), 0);
      const activeStudents = sList.filter((s) => s.status !== 'Vacated').length;
      const vacatedStudents = sList.filter((s) => s.status === 'Vacated').length;
      const totalStudents = sList.length;
      const vacantBeds = Math.max(0, totalCapacity - activeStudents);
      const occupancyRate = totalCapacity > 0
        ? `${((activeStudents / totalCapacity) * 100).toFixed(1)}%`
        : '0.0%';
      const monthlyRentTotal = sList.reduce((acc, s) => {
        const rent = s.rent !== null && s.rent !== undefined ? Number(s.rent) : (s.room?.rent ? Number(s.room.rent) : 0);
        return acc + rent;
      }, 0);

      grandRooms += totalRooms;
      grandCapacity += totalCapacity;
      grandOccupied += activeStudents;
      grandVacant += vacantBeds;
      grandActiveStudents += activeStudents;
      grandVacatedStudents += vacatedStudents;
      grandTotalStudents += totalStudents;
      grandMonthlyRent += monthlyRentTotal;

      summaryRows.push({
        'Block Name': b,
        'Total Rooms': totalRooms,
        'Bed Capacity': totalCapacity,
        'Occupied Beds': activeStudents,
        'Vacant / Available Beds': vacantBeds,
        'Occupancy Rate': occupancyRate,
        'Active Students (In)': activeStudents,
        'Vacated Students': vacatedStudents,
        'Total Students Allocated': totalStudents,
        'Total Monthly Rent (₹)': monthlyRentTotal,
      });
    }

    // Add unallocated summary row
    const unallocActive = unallocatedStudents.filter((s) => s.status !== 'Vacated').length;
    const unallocVacated = unallocatedStudents.filter((s) => s.status === 'Vacated').length;
    summaryRows.push({
      'Block Name': 'Unallocated / Vacated (No Room)',
      'Total Rooms': 0,
      'Bed Capacity': 0,
      'Occupied Beds': 0,
      'Vacant / Available Beds': 0,
      'Occupancy Rate': 'N/A',
      'Active Students (In)': unallocActive,
      'Vacated Students': unallocVacated,
      'Total Students Allocated': unallocatedStudents.length,
      'Total Monthly Rent (₹)': unallocatedStudents.reduce((acc, s) => acc + (Number(s.rent) || 0), 0),
    });

    // Add Grand Total row
    const overallRate = grandCapacity > 0
      ? `${((grandOccupied / grandCapacity) * 100).toFixed(1)}%`
      : '0.0%';
    summaryRows.push({
      'Block Name': '★ OVERALL TOTAL / HOSTEL SUMMARY',
      'Total Rooms': grandRooms,
      'Bed Capacity': grandCapacity,
      'Occupied Beds': grandOccupied,
      'Vacant / Available Beds': grandVacant,
      'Occupancy Rate': overallRate,
      'Active Students (In)': grandActiveStudents + unallocActive,
      'Vacated Students': grandVacatedStudents + unallocVacated,
      'Total Students Allocated': grandTotalStudents + unallocatedStudents.length,
      'Total Monthly Rent (₹)': grandMonthlyRent + unallocatedStudents.reduce((acc, s) => acc + (Number(s.rent) || 0), 0),
    });

    // -------------------------------------------------------------
    // SHEET 2: ALL STUDENTS (BLOCK-WISE MASTER LIST)
    // -------------------------------------------------------------
    const allStudentsRows = allStudentsSorted.map((s, idx) =>
      formatStudentRow(s, idx)
    );

    // -------------------------------------------------------------
    // SHEET 3: ROOM OCCUPANCY & VACANCY MATRIX
    // -------------------------------------------------------------
    const roomMatrixRows = [];
    let roomSNo = 1;

    for (const b of blockOrder) {
      const rList = blockRoomsMap.get(b) || [];
      for (const r of rList) {
        const roomStudents = r.students || [];
        const activeOcc = roomStudents.filter((s) => s.status !== 'Vacated');
        const available = Math.max(0, (r.capacity || 0) - activeOcc.length);
        const occStatus =
          available === 0
            ? 'FULL'
            : activeOcc.length === 0
            ? 'VACANT'
            : `AVAILABLE (${available} left)`;
        const studentNames = activeOcc.map((s) => s.name).join(', ') || '(Empty)';

        roomMatrixRows.push({
          'S.No': roomSNo++,
          'Block': b,
          'Room No': r.id,
          'Floor': r.floor !== undefined && r.floor !== null ? r.floor : 1,
          'Room Type': r.type || '',
          'Capacity': r.capacity || 0,
          'Occupied (Active)': activeOcc.length,
          'Available Beds': available,
          'Status': occStatus,
          'Room Rent (₹)': r.rent || 0,
          'Mess Fee (₹)': r.messFee || 0,
          'Current Occupants': studentNames,
        });
      }
    }

    // -------------------------------------------------------------
    // PREPARE EXCEL WORKBOOK
    // -------------------------------------------------------------
    const outputDir = path.resolve(__dirname, 'exports');
    const blocksDir = path.resolve(outputDir, 'blocks');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    if (!fs.existsSync(blocksDir)) fs.mkdirSync(blocksDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const masterExcelFilename = `block_wise_student_report_${timestamp}.xlsx`;
    const masterExcelLatest = `block_wise_student_report_latest.xlsx`;
    const masterExcelPath = path.join(outputDir, masterExcelFilename);
    const masterExcelLatestPath = path.join(outputDir, masterExcelLatest);
    const rootExcelPath = path.resolve(__dirname, '../block_wise_student_report_latest.xlsx');

    if (XLSX) {
      const workbook = XLSX.utils.book_new();

      // 1. Add Summary Dashboard
      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      wsSummary['!cols'] = autoFitColumns(summaryRows);
      XLSX.utils.book_append_sheet(workbook, wsSummary, 'Block Summary');

      // 2. Add All Students Sheet
      const wsAll = XLSX.utils.json_to_sheet(allStudentsRows);
      wsAll['!cols'] = autoFitColumns(allStudentsRows);
      XLSX.utils.book_append_sheet(workbook, wsAll, 'All Students');

      // 3. Add Individual Sheets for Each Block
      for (const b of blockOrder) {
        const sList = blockStudentsMap.get(b) || [];
        const rows = sList.map((s, idx) => formatStudentRow(s, idx, b));
        const sheetName = b.replace(/[:\\/?*\[\]]/g, '').slice(0, 31); // Excel sheet max 31 chars
        const wsBlock = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'Message': `No students in ${b}` }]);
        if (rows.length > 0) {
          wsBlock['!cols'] = autoFitColumns(rows);
        }
        XLSX.utils.book_append_sheet(workbook, wsBlock, sheetName);

        // Also create standalone individual workbook for this block
        const blockWb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(blockWb, wsBlock, sheetName);
        const blockFileName = `${b.replace(/\s+/g, '_')}_Students.xlsx`;
        XLSX.writeFile(blockWb, path.join(blocksDir, blockFileName));
      }

      // 4. Add Unallocated / Vacated Sheet
      const unallocRows = unallocatedStudents.map((s, idx) => formatStudentRow(s, idx, 'Unallocated'));
      const wsUnalloc = XLSX.utils.json_to_sheet(
        unallocRows.length > 0 ? unallocRows : [{ 'Message': 'No unallocated students' }]
      );
      if (unallocRows.length > 0) wsUnalloc['!cols'] = autoFitColumns(unallocRows);
      XLSX.utils.book_append_sheet(workbook, wsUnalloc, 'Unallocated & Vacated');

      // 5. Add Room Vacancy Matrix Sheet
      const wsRooms = XLSX.utils.json_to_sheet(roomMatrixRows);
      wsRooms['!cols'] = autoFitColumns(roomMatrixRows);
      XLSX.utils.book_append_sheet(workbook, wsRooms, 'Room Vacancy Matrix');

      // Write master workbook
      XLSX.writeFile(workbook, masterExcelPath);
      XLSX.writeFile(workbook, masterExcelLatestPath);
      XLSX.writeFile(workbook, rootExcelPath);

      console.log('✓ Successfully created Master Excel Report with multiple tabs:');
      console.log(`  -> ${masterExcelPath}`);
      console.log(`  -> ${masterExcelLatestPath}`);
      console.log(`  -> ${rootExcelPath}`);
      console.log(`✓ Also generated individual block Excel files in: ${blocksDir}\n`);
    } else {
      console.warn('! XLSX module not found, fallback to CSV generation.');
    }

    // -------------------------------------------------------------
    // GENERATE CSV BACKUP (UTF-8 BOM, fully Excel-compatible)
    // -------------------------------------------------------------
    const csvEscape = (val) => {
      const str = String(val === null || val === undefined ? '' : val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    if (allStudentsRows.length > 0) {
      const headers = Object.keys(allStudentsRows[0]);
      const csvContent =
        '\uFEFF' +
        headers.map(csvEscape).join(',') +
        '\n' +
        allStudentsRows
          .map((row) => headers.map((h) => csvEscape(row[h])).join(','))
          .join('\n');

      const csvLatestPath = path.join(outputDir, 'block_wise_student_report_latest.csv');
      const csvPath = path.join(outputDir, `block_wise_student_report_${timestamp}.csv`);
      fs.writeFileSync(csvPath, csvContent, 'utf8');
      fs.writeFileSync(csvLatestPath, csvContent, 'utf8');
      console.log(`✓ CSV Export generated: ${csvLatestPath}`);
    }

    // -------------------------------------------------------------
    // PRINT TERMINAL SUMMARY TABLE
    // -------------------------------------------------------------
    console.log('\n--- BLOCK-WISE SUMMARY SUMMARY ---');
    console.table(
      summaryRows.map((r) => ({
        'Block': r['Block Name'],
        'Rooms': r['Total Rooms'],
        'Capacity': r['Bed Capacity'],
        'Occupied': r['Occupied Beds'],
        'Vacant': r['Vacant / Available Beds'],
        'Occ %': r['Occupancy Rate'],
        'Students': r['Total Students Allocated'],
        'Rent (₹)': r['Total Monthly Rent (₹)'],
      }))
    );
    console.log('---------------------------------------------------\n');

    return {
      masterExcelLatestPath,
      rootExcelPath,
      summary: summaryRows,
    };
  } catch (error) {
    console.error('Error generating block-wise student report:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  exportBlockWiseStudents();
}

module.exports = { exportBlockWiseStudents };
