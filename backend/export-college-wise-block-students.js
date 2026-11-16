const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Load xlsx
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

// Natural sort for room numbers (e.g. A1, A2, ... A9, A10, A11)
function naturalSort(a, b) {
  return String(a || '').localeCompare(String(b || ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

// Normalize block naming to standard blocks
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
    return { wch: Math.min(Math.max(maxLen + 3, 10), 50) };
  });
}

// Format student row for details sheet
function formatStudentRow(s, index) {
  const block = s.room ? normalizeBlock(s.room.block, s.roomNo) : 'Unallocated';
  const collegeName = s.college ? s.college.name : 'No College Assigned';
  const collegeCode = s.college?.shortName ? s.college.shortName.trim() : (s.college ? '-' : 'UNASSIGNED');
  const roomStr = s.roomNo ? s.roomNo : 'NOT ALLOCATED';
  const bedStr = s.bedNo ? s.bedNo : '-';
  const floorVal = s.room?.floor !== undefined && s.room?.floor !== null ? s.room.floor : '-';
  const rentVal = s.rent !== null && s.rent !== undefined ? Number(s.rent) : (s.room?.rent ? Number(s.room.rent) : 0);

  return {
    'S.No': index + 1,
    'College Name': collegeName,
    'College Code': collegeCode,
    'Block': block,
    'Room No': roomStr,
    'Bed No': bedStr,
    'Floor': floorVal,
    'Student Name': s.name || '',
    'Reg No': s.regNo || '',
    'Manual / Roll ID': s.manualRegsiName || '',
    'Mobile Number': s.mobileNo || '',
    'Status': s.status || 'Active',
    'Degree / Course': s.educationalQua || '',
    'Year': s.pursuingYear || '',
    'Monthly Rent (₹)': rentVal,
    'Fee Status': s.feeStatus || 'Un-Paid',
    'Food Preference': s.foodType || 'N/A',
    'Date of Joining': formatDate(s.dateOfJoining),
    'Father Name': s.fatherName || '',
    'Father Mobile': s.fatherMobileNo || '',
    'Mother Name': s.motherName || '',
    'Mother Mobile': s.motherMobileNo || '',
    'Guardian Name': s.guardianName || '',
    'Emergency Contact': s.emergencyContact || '',
    'Gender': s.gender || '',
    'Blood Group': s.bloodGroup || '',
    'Aadhar Number': s.aadharNo || '',
    'Email ID': s.emailId || '',
  };
}

// CSV escaping utility
function csvEscape(val) {
  const str = String(val === null || val === undefined ? '' : val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function writeCsvFile(filePath, rows) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const content =
    '\uFEFF' +
    headers.map(csvEscape).join(',') +
    '\n' +
    rows.map((row) => headers.map((h) => csvEscape(row[h])).join(',')).join('\n');
  fs.writeFileSync(filePath, content, 'utf8');
}

async function exportCollegeWiseBlockStudents() {
  console.log('====================================================================');
  console.log('  VSR HMS - COLLEGE-WISE BLOCK STUDENT COUNTS EXCEL REPORT GENERATOR ');
  console.log('====================================================================\n');

  try {
    // 1. Fetch all colleges
    const allColleges = await prisma.college.findMany({
      orderBy: { name: 'asc' },
    });

    // 2. Fetch all rooms
    const allRooms = await prisma.room.findMany({
      include: {
        students: {
          include: {
            college: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    // 3. Fetch all students
    const allStudents = await prisma.student.findMany({
      include: {
        college: true,
        room: true,
      },
      orderBy: [
        { name: 'asc' },
      ],
    });

    console.log(`✓ Total Colleges in DB:   ${allColleges.length}`);
    console.log(`✓ Total Rooms in DB:      ${allRooms.length}`);
    console.log(`✓ Total Students in DB:   ${allStudents.length}`);

    const activeStudents = allStudents.filter((s) => s.status !== 'Vacated');
    const vacatedStudents = allStudents.filter((s) => s.status === 'Vacated');
    console.log(`  -> Active Hostellers:   ${activeStudents.length}`);
    console.log(`  -> Vacated Students:    ${vacatedStudents.length}\n`);

    // Standard block ordering
    const blockOrder = [
      'Block A',
      'Block B',
      'Block C',
      'Block D',
      'Block E',
      'Single Rooms',
      'Dormitory',
      'Unallocated',
    ];

    // Compute Block Stats from Room model
    const blockStatsMap = new Map();
    blockOrder.forEach((b) => {
      blockStatsMap.set(b, {
        block: b,
        rooms: 0,
        capacity: 0,
        activeOccupants: 0,
        vacatedCount: 0,
        collegeActiveCounts: {},
      });
    });

    for (const r of allRooms) {
      const b = normalizeBlock(r.block, r.id);
      if (!blockStatsMap.has(b)) {
        blockStatsMap.set(b, {
          block: b,
          rooms: 0,
          capacity: 0,
          activeOccupants: 0,
          vacatedCount: 0,
          collegeActiveCounts: {},
        });
      }
      const st = blockStatsMap.get(b);
      st.rooms++;
      st.capacity += (r.capacity || 0);
    }

    // Identify all unique colleges present among students
    // We group by college key (using college id or 'NO_COLLEGE')
    const collegeMap = new Map();

    for (const s of allStudents) {
      const cid = s.collegeId || 'NO_COLLEGE';
      const cname = s.college ? s.college.name : 'No College Assigned';
      const ccode = s.college?.shortName ? s.college.shortName.trim() : (s.college ? '-' : 'UNASSIGNED');

      if (!collegeMap.has(cid)) {
        collegeMap.set(cid, {
          id: cid,
          name: cname,
          code: ccode,
          activeCounts: {},
          vacatedCounts: {},
          totalCounts: {},
          activeTotal: 0,
          vacatedTotal: 0,
          grandTotal: 0,
          totalRent: 0,
          students: [],
        });
        blockOrder.forEach((b) => {
          collegeMap.get(cid).activeCounts[b] = 0;
          collegeMap.get(cid).vacatedCounts[b] = 0;
          collegeMap.get(cid).totalCounts[b] = 0;
        });
      }

      const collegeData = collegeMap.get(cid);
      const block = s.room ? normalizeBlock(s.room.block, s.roomNo) : 'Unallocated';
      const isVacated = s.status === 'Vacated';
      const rent = s.rent !== null && s.rent !== undefined ? Number(s.rent) : (s.room?.rent ? Number(s.room.rent) : 0);

      collegeData.students.push(s);
      collegeData.totalCounts[block] = (collegeData.totalCounts[block] || 0) + 1;
      collegeData.grandTotal++;

      if (isVacated) {
        collegeData.vacatedCounts[block] = (collegeData.vacatedCounts[block] || 0) + 1;
        collegeData.vacatedTotal++;
      } else {
        collegeData.activeCounts[block] = (collegeData.activeCounts[block] || 0) + 1;
        collegeData.activeTotal++;
        collegeData.totalRent += rent;

        // Block stat tally
        const bStats = blockStatsMap.get(block);
        if (bStats) {
          bStats.activeOccupants++;
          bStats.collegeActiveCounts[cname] = (bStats.collegeActiveCounts[cname] || 0) + 1;
        }
      }
    }

    // Also include any registered College in DB that has 0 students so it's complete
    for (const c of allColleges) {
      if (!collegeMap.has(c.id)) {
        collegeMap.set(c.id, {
          id: c.id,
          name: c.name,
          code: c.shortName ? c.shortName.trim() : '-',
          activeCounts: {},
          vacatedCounts: {},
          totalCounts: {},
          activeTotal: 0,
          vacatedTotal: 0,
          grandTotal: 0,
          totalRent: 0,
          students: [],
        });
        blockOrder.forEach((b) => {
          collegeMap.get(c.id).activeCounts[b] = 0;
          collegeMap.get(c.id).vacatedCounts[b] = 0;
          collegeMap.get(c.id).totalCounts[b] = 0;
        });
      }
    }

    // Sort colleges:
    // 1. By activeTotal descending
    // 2. Put 'No College Assigned' after populated colleges
    // 3. 0 count colleges at bottom
    const sortedColleges = Array.from(collegeMap.values()).sort((a, b) => {
      if (a.id === 'NO_COLLEGE' && b.activeTotal > 0) return 1;
      if (b.id === 'NO_COLLEGE' && a.activeTotal > 0) return -1;
      if (b.activeTotal !== a.activeTotal) return b.activeTotal - a.activeTotal;
      if (b.grandTotal !== a.grandTotal) return b.grandTotal - a.grandTotal;
      return a.name.localeCompare(b.name);
    });

    // -----------------------------------------------------------------
    // SHEET 1: ACTIVE STUDENTS MATRIX (College vs Block)
    // -----------------------------------------------------------------
    const activeMatrixRows = [];
    const activeColTotals = {};
    blockOrder.forEach((b) => (activeColTotals[b] = 0));
    let grandActiveSum = 0;

    sortedColleges.forEach((c, idx) => {
      const row = {
        'S.No': idx + 1,
        'College Name': c.name,
        'College Code': c.code,
      };

      let rowActive = 0;
      blockOrder.forEach((b) => {
        const count = c.activeCounts[b] || 0;
        row[b] = count;
        activeColTotals[b] += count;
        rowActive += count;
      });

      row['Total Active'] = rowActive;
      row['% of Hostel Active'] =
        activeStudents.length > 0
          ? `${((rowActive / activeStudents.length) * 100).toFixed(1)}%`
          : '0.0%';

      grandActiveSum += rowActive;
      activeMatrixRows.push(row);
    });

    // Add Totals row
    const activeTotalsRow = {
      'S.No': '',
      'College Name': '★ TOTAL ACTIVE HOSTELLERS',
      'College Code': 'ALL',
    };
    blockOrder.forEach((b) => {
      activeTotalsRow[b] = activeColTotals[b];
    });
    activeTotalsRow['Total Active'] = grandActiveSum;
    activeTotalsRow['% of Hostel Active'] = '100.0%';
    activeMatrixRows.push(activeTotalsRow);

    // -----------------------------------------------------------------
    // SHEET 2: TOTAL STUDENTS MATRIX (Active + Vacated)
    // -----------------------------------------------------------------
    const totalMatrixRows = [];
    const totalColTotals = {};
    blockOrder.forEach((b) => (totalColTotals[b] = 0));
    let grandTotalSum = 0;

    sortedColleges.forEach((c, idx) => {
      const row = {
        'S.No': idx + 1,
        'College Name': c.name,
        'College Code': c.code,
      };

      let rowTotal = 0;
      blockOrder.forEach((b) => {
        const count = c.totalCounts[b] || 0;
        row[b] = count;
        totalColTotals[b] += count;
        rowTotal += count;
      });

      row['Grand Total Enrolled'] = rowTotal;
      row['% of Total Enrolled'] =
        allStudents.length > 0
          ? `${((rowTotal / allStudents.length) * 100).toFixed(1)}%`
          : '0.0%';

      grandTotalSum += rowTotal;
      totalMatrixRows.push(row);
    });

    // Add Totals row
    const totalTotalsRow = {
      'S.No': '',
      'College Name': '★ GRAND TOTAL REGISTERED',
      'College Code': 'ALL',
    };
    blockOrder.forEach((b) => {
      totalTotalsRow[b] = totalColTotals[b];
    });
    totalTotalsRow['Grand Total Enrolled'] = grandTotalSum;
    totalTotalsRow['% of Total Enrolled'] = '100.0%';
    totalMatrixRows.push(totalTotalsRow);

    // -----------------------------------------------------------------
    // SHEET 3: COLLEGE SUMMARY & OCCUPANCY OVERVIEW
    // -----------------------------------------------------------------
    const collegeSummaryRows = sortedColleges.map((c, idx) => {
      const allocatedActive = blockOrder
        .filter((b) => b !== 'Unallocated')
        .reduce((sum, b) => sum + (c.activeCounts[b] || 0), 0);
      const unallocatedActive = c.activeCounts['Unallocated'] || 0;

      // Find top block
      let topBlock = '-';
      let topCount = 0;
      blockOrder.forEach((b) => {
        if (b !== 'Unallocated' && (c.activeCounts[b] || 0) > topCount) {
          topCount = c.activeCounts[b];
          topBlock = `${b} (${topCount})`;
        }
      });

      return {
        'S.No': idx + 1,
        'College Name': c.name,
        'College Code': c.code,
        'Active Hostellers (In)': c.activeTotal,
        'Vacated Students': c.vacatedTotal,
        'Total Registered Students': c.grandTotal,
        'Allocated in Rooms': allocatedActive,
        'Unallocated Active': unallocatedActive,
        'Primary Hostel Block': topBlock,
        'Total Monthly Rent (₹)': c.totalRent,
        'Avg Rent / Active Student (₹)':
          c.activeTotal > 0 ? Math.round(c.totalRent / c.activeTotal) : 0,
        '% of Hostel Active':
          activeStudents.length > 0
            ? `${((c.activeTotal / activeStudents.length) * 100).toFixed(1)}%`
            : '0.0%',
      };
    });

    // Add Grand Total row to College Summary
    const sumActive = sortedColleges.reduce((acc, c) => acc + c.activeTotal, 0);
    const sumVacated = sortedColleges.reduce((acc, c) => acc + c.vacatedTotal, 0);
    const sumTotal = sortedColleges.reduce((acc, c) => acc + c.grandTotal, 0);
    const sumAllocated = sortedColleges.reduce(
      (acc, c) =>
        acc +
        blockOrder
          .filter((b) => b !== 'Unallocated')
          .reduce((s, b) => s + (c.activeCounts[b] || 0), 0),
      0
    );
    const sumUnallocated = sortedColleges.reduce(
      (acc, c) => acc + (c.activeCounts['Unallocated'] || 0),
      0
    );
    const sumRent = sortedColleges.reduce((acc, c) => acc + c.totalRent, 0);

    collegeSummaryRows.push({
      'S.No': '',
      'College Name': '★ OVERALL TOTAL / HOSTEL SUMMARY',
      'College Code': 'ALL',
      'Active Hostellers (In)': sumActive,
      'Vacated Students': sumVacated,
      'Total Registered Students': sumTotal,
      'Allocated in Rooms': sumAllocated,
      'Unallocated Active': sumUnallocated,
      'Primary Hostel Block': 'All Blocks',
      'Total Monthly Rent (₹)': sumRent,
      'Avg Rent / Active Student (₹)': sumActive > 0 ? Math.round(sumRent / sumActive) : 0,
      '% of Hostel Active': '100.0%',
    });

    // -----------------------------------------------------------------
    // SHEET 4: BLOCK SUMMARY & COLLEGE DISTRIBUTION
    // -----------------------------------------------------------------
    const blockSummaryRows = [];
    let bSNo = 1;
    let hostelCapSum = 0;
    let hostelActiveSum = 0;
    let hostelVacantSum = 0;
    let hostelRoomsSum = 0;

    for (const b of blockOrder) {
      const st = blockStatsMap.get(b);
      const isUnallocated = b === 'Unallocated';
      const vacantBeds = isUnallocated ? 0 : Math.max(0, st.capacity - st.activeOccupants);
      const occRate =
        st.capacity > 0
          ? `${((st.activeOccupants / st.capacity) * 100).toFixed(1)}%`
          : isUnallocated
          ? 'N/A'
          : '0.0%';

      if (!isUnallocated) {
        hostelCapSum += st.capacity;
        hostelActiveSum += st.activeOccupants;
        hostelVacantSum += vacantBeds;
        hostelRoomsSum += st.rooms;
      }

      // College breakdown string
      const cCounts = Object.entries(st.collegeActiveCounts)
        .sort((x, y) => y[1] - x[1])
        .map(([cname, cnt]) => `${cname}: ${cnt}`);
      const breakdownStr = cCounts.length > 0 ? cCounts.join(' | ') : '(None)';

      blockSummaryRows.push({
        'S.No': bSNo++,
        'Block Name': b,
        'Total Rooms': isUnallocated ? '-' : st.rooms,
        'Bed Capacity': isUnallocated ? '-' : st.capacity,
        'Occupied Beds (Active)': st.activeOccupants,
        'Vacant Beds': isUnallocated ? '-' : vacantBeds,
        'Occupancy Rate': occRate,
        'No. of Colleges': Object.keys(st.collegeActiveCounts).length,
        'College Distribution Breakdown': breakdownStr,
      });
    }

    // Add overall row
    const overallOccRate =
      hostelCapSum > 0 ? `${((hostelActiveSum / hostelCapSum) * 100).toFixed(1)}%` : '0.0%';
    blockSummaryRows.push({
      'S.No': '',
      'Block Name': '★ OVERALL HOSTEL OCCUPANCY',
      'Total Rooms': hostelRoomsSum,
      'Bed Capacity': hostelCapSum,
      'Occupied Beds (Active)': hostelActiveSum,
      'Vacant Beds': hostelVacantSum,
      'Occupancy Rate': overallOccRate,
      'No. of Colleges': sortedColleges.filter((c) => c.activeTotal > 0).length,
      'College Distribution Breakdown': 'All Colleges across All Blocks',
    });

    // -----------------------------------------------------------------
    // SHEET 5: FULL STUDENT ROSTER (All 344 Students)
    // -----------------------------------------------------------------
    // Sort students by College Name -> Block -> Room No -> Name
    const allStudentsSorted = [...allStudents].sort((s1, s2) => {
      const c1 = s1.college ? s1.college.name : 'ZZZ_No College';
      const c2 = s2.college ? s2.college.name : 'ZZZ_No College';
      const cCmp = c1.localeCompare(c2);
      if (cCmp !== 0) return cCmp;

      const b1 = s1.room ? normalizeBlock(s1.room.block, s1.roomNo) : 'ZZZ_Unallocated';
      const b2 = s2.room ? normalizeBlock(s2.room.block, s2.roomNo) : 'ZZZ_Unallocated';
      const bCmp = b1.localeCompare(b2);
      if (bCmp !== 0) return bCmp;

      const rCmp = naturalSort(s1.roomNo || '', s2.roomNo || '');
      if (rCmp !== 0) return rCmp;

      return (s1.name || '').localeCompare(s2.name || '');
    });

    const studentRosterRows = allStudentsSorted.map((s, idx) =>
      formatStudentRow(s, idx)
    );

    // -----------------------------------------------------------------
    // OUTPUT PATHS AND WORKBOOK CREATION
    // -----------------------------------------------------------------
    const outputDir = path.resolve(__dirname, 'exports');
    const uploadExportDir = path.resolve(__dirname, 'uploads/exports');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    if (!fs.existsSync(uploadExportDir)) fs.mkdirSync(uploadExportDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const excelFilename = `college_wise_block_student_counts_${timestamp}.xlsx`;
    const excelLatestFilename = `college_wise_block_student_counts_latest.xlsx`;
    const excelPath = path.join(outputDir, excelFilename);
    const excelLatestPath = path.join(outputDir, excelLatestFilename);
    const rootExcelPath = path.resolve(__dirname, '../college_wise_block_student_counts_latest.xlsx');
    const localExcelPath = path.resolve(__dirname, 'college_wise_block_student_counts_latest.xlsx');
    const uploadExcelPath = path.join(uploadExportDir, excelLatestFilename);

    // CSV Paths
    const csvMatrixPath = path.join(outputDir, 'college_wise_block_active_matrix_latest.csv');
    const csvTotalMatrixPath = path.join(outputDir, 'college_wise_block_total_matrix_latest.csv');
    const csvSummaryPath = path.join(outputDir, 'college_wise_block_summary_latest.csv');
    const csvRosterPath = path.join(outputDir, 'college_wise_block_student_roster_latest.csv');

    const uploadCsvMatrixPath = path.join(uploadExportDir, 'college_wise_block_active_matrix_latest.csv');
    const uploadCsvTotalMatrixPath = path.join(uploadExportDir, 'college_wise_block_total_matrix_latest.csv');
    const uploadCsvSummaryPath = path.join(uploadExportDir, 'college_wise_block_summary_latest.csv');
    const uploadCsvRosterPath = path.join(uploadExportDir, 'college_wise_block_student_roster_latest.csv');

    if (XLSX) {
      const workbook = XLSX.utils.book_new();

      // Tab 1: Active Count Matrix
      const wsActive = XLSX.utils.json_to_sheet(activeMatrixRows);
      wsActive['!cols'] = autoFitColumns(activeMatrixRows);
      XLSX.utils.book_append_sheet(workbook, wsActive, 'Active Count Matrix');

      // Tab 2: Total Enrolled Matrix
      const wsTotal = XLSX.utils.json_to_sheet(totalMatrixRows);
      wsTotal['!cols'] = autoFitColumns(totalMatrixRows);
      XLSX.utils.book_append_sheet(workbook, wsTotal, 'Total Enrolled Matrix');

      // Tab 3: College Summary
      const wsColSummary = XLSX.utils.json_to_sheet(collegeSummaryRows);
      wsColSummary['!cols'] = autoFitColumns(collegeSummaryRows);
      XLSX.utils.book_append_sheet(workbook, wsColSummary, 'College Summary');

      // Tab 4: Block Summary
      const wsBlockSummary = XLSX.utils.json_to_sheet(blockSummaryRows);
      wsBlockSummary['!cols'] = autoFitColumns(blockSummaryRows);
      XLSX.utils.book_append_sheet(workbook, wsBlockSummary, 'Block Summary');

      // Tab 5: Master Student Roster
      const wsRoster = XLSX.utils.json_to_sheet(studentRosterRows);
      wsRoster['!cols'] = autoFitColumns(studentRosterRows);
      XLSX.utils.book_append_sheet(workbook, wsRoster, 'Student Roster (All)');

      // Tab 6+: Specific Major College Tabs
      // 1. SSM Students
      const ssmStudents = allStudentsSorted.filter((s) => s.college?.name === 'SSM');
      if (ssmStudents.length > 0) {
        const ssmRows = ssmStudents.map((s, idx) => formatStudentRow(s, idx));
        const wsSSM = XLSX.utils.json_to_sheet(ssmRows);
        wsSSM['!cols'] = autoFitColumns(ssmRows);
        XLSX.utils.book_append_sheet(workbook, wsSSM, 'SSM Students');
      }

      // 2. JKKM Students
      const jkkmStudents = allStudentsSorted.filter((s) => s.college?.name === 'JKKM');
      if (jkkmStudents.length > 0) {
        const jkkmRows = jkkmStudents.map((s, idx) => formatStudentRow(s, idx));
        const wsJKKM = XLSX.utils.json_to_sheet(jkkmRows);
        wsJKKM['!cols'] = autoFitColumns(jkkmRows);
        XLSX.utils.book_append_sheet(workbook, wsJKKM, 'JKKM Students');
      }

      // 3. JKKN Group (JKKN, JKKN DENTAL, JKKN PHARMACY)
      const jkknStudents = allStudentsSorted.filter(
        (s) => s.college && s.college.name.toUpperCase().startsWith('JKKN')
      );
      if (jkknStudents.length > 0) {
        const jkknRows = jkknStudents.map((s, idx) => formatStudentRow(s, idx));
        const wsJKKN = XLSX.utils.json_to_sheet(jkknRows);
        wsJKKN['!cols'] = autoFitColumns(jkknRows);
        XLSX.utils.book_append_sheet(workbook, wsJKKN, 'JKKN Group Students');
      }

      // 4. Excel & Other Colleges
      const otherStudents = allStudentsSorted.filter(
        (s) =>
          s.college &&
          s.college.name !== 'SSM' &&
          s.college.name !== 'JKKM' &&
          !s.college.name.toUpperCase().startsWith('JKKN')
      );
      if (otherStudents.length > 0) {
        const otherRows = otherStudents.map((s, idx) => formatStudentRow(s, idx));
        const wsOther = XLSX.utils.json_to_sheet(otherRows);
        wsOther['!cols'] = autoFitColumns(otherRows);
        XLSX.utils.book_append_sheet(workbook, wsOther, 'Other Colleges');
      }

      // 5. No College Assigned
      const noClgStudents = allStudentsSorted.filter((s) => !s.college);
      if (noClgStudents.length > 0) {
        const noClgRows = noClgStudents.map((s, idx) => formatStudentRow(s, idx));
        const wsNoClg = XLSX.utils.json_to_sheet(noClgRows);
        wsNoClg['!cols'] = autoFitColumns(noClgRows);
        XLSX.utils.book_append_sheet(workbook, wsNoClg, 'No College Assigned');
      }

      // Save files
      XLSX.writeFile(workbook, excelPath);
      XLSX.writeFile(workbook, excelLatestPath);
      XLSX.writeFile(workbook, rootExcelPath);
      XLSX.writeFile(workbook, localExcelPath);
      XLSX.writeFile(workbook, uploadExcelPath);

      console.log('✓ Successfully generated Master College-wise Block Excel Workbook:');
      console.log(`  -> ${excelPath}`);
      console.log(`  -> ${excelLatestPath}`);
      console.log(`  -> ${rootExcelPath}`);
      console.log(`  -> ${localExcelPath}`);
      console.log(`  -> ${uploadExcelPath}\n`);
    } else {
      console.warn('! Warning: xlsx module not available, generating CSV files only.');
    }

    // Write CSV exports for easy terminal / CLI / lightweight usage
    writeCsvFile(csvMatrixPath, activeMatrixRows);
    writeCsvFile(csvTotalMatrixPath, totalMatrixRows);
    writeCsvFile(csvSummaryPath, collegeSummaryRows);
    writeCsvFile(csvRosterPath, studentRosterRows);

    writeCsvFile(uploadCsvMatrixPath, activeMatrixRows);
    writeCsvFile(uploadCsvTotalMatrixPath, totalMatrixRows);
    writeCsvFile(uploadCsvSummaryPath, collegeSummaryRows);
    writeCsvFile(uploadCsvRosterPath, studentRosterRows);

    console.log('✓ Generated CSV Backups:');
    console.log(`  -> ${csvMatrixPath}`);
    console.log(`  -> ${csvTotalMatrixPath}`);
    console.log(`  -> ${csvSummaryPath}`);
    console.log(`  -> ${csvRosterPath}\n`);

    // -----------------------------------------------------------------
    // PRINT BEAUTIFUL CONSOLE REPORTS
    // -----------------------------------------------------------------
    console.log('====================================================================');
    console.log('               ACTIVE STUDENTS (COLLEGE × BLOCK MATRIX)             ');
    console.log('====================================================================');
    console.table(
      activeMatrixRows.map((r) => ({
        'College': r['College Name'],
        'A': r['Block A'],
        'B': r['Block B'],
        'C': r['Block C'],
        'D': r['Block D'],
        'E': r['Block E'],
        'Single': r['Single Rooms'],
        'Dorm': r['Dormitory'],
        'Unalloc': r['Unallocated'],
        'Active Total': r['Total Active'],
        '%': r['% of Hostel Active'],
      }))
    );

    console.log('\n====================================================================');
    console.log('                     COLLEGE SUMMARY OVERVIEW                       ');
    console.log('====================================================================');
    console.table(
      collegeSummaryRows.map((r) => ({
        'College Name': r['College Name'],
        'Active': r['Active Hostellers (In)'],
        'Vacated': r['Vacated Students'],
        'Total Enrolled': r['Total Registered Students'],
        'Primary Block': r['Primary Hostel Block'],
        'Rent (₹)': r['Total Monthly Rent (₹)'],
        '% Share': r['% of Hostel Active'],
      }))
    );

    console.log('\n====================================================================');
    console.log('                     BLOCK OCCUPANCY OVERVIEW                       ');
    console.log('====================================================================');
    console.table(
      blockSummaryRows.map((r) => ({
        'Block': r['Block Name'],
        'Rooms': r['Total Rooms'],
        'Capacity': r['Bed Capacity'],
        'Occupied': r['Occupied Beds (Active)'],
        'Vacant': r['Vacant Beds'],
        'Occ %': r['Occupancy Rate'],
        'Colleges': r['No. of Colleges'],
      }))
    );

    return {
      excelPath,
      excelLatestPath,
      rootExcelPath,
      activeMatrixRows,
      collegeSummaryRows,
      blockSummaryRows,
    };
  } catch (err) {
    console.error('Error exporting college-wise block report:', err);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  exportCollegeWiseBlockStudents();
}

module.exports = { exportCollegeWiseBlockStudents };
