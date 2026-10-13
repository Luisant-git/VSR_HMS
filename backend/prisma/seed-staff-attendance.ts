import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seeds attendance records for all active staff members
 * for September 2026 and October 2026 (up to today).
 * This ensures the Salary Disbursement modal shows real attendance stats
 * (Present, Absent, Half Day, On Leave) when staff + month are selected.
 */
async function main() {
  console.log('--- Seeding Staff Attendance Records ---');

  const staffModel = (prisma as any).staff;
  const attendanceModel = (prisma as any).staffAttendance;

  // 1. Get all active staff
  const allStaff = await staffModel.findMany({ where: { status: 'Active' } });

  if (allStaff.length === 0) {
    console.log('⚠️  No active staff found. Run seed-staff.ts first.');
    return;
  }

  console.log(`Found ${allStaff.length} active staff members.`);

  // 2. Define months to seed
  const monthsToSeed = [
    { year: 2026, month: 9, name: 'September' },  // Full month: 1-30
    { year: 2026, month: 10, name: 'October' },    // Partial: 1 to today (13)
  ];

  // Typical attendance patterns (realistic distribution)
  const statusPatterns: Record<string, string[]> = {
    // Pattern A: Very regular worker (most present, few half days)
    patternA: [
      'Present', 'Present', 'Present', 'Present', 'Present', 'Present',
      'Present', 'Present', 'Present', 'Present', 'Half Day', 'Present',
      'Present', 'Present', 'Present', 'Present', 'Present', 'Present',
      'Present', 'Present', 'Present', 'On Leave', 'Present', 'Present',
      'Present', 'Present', 'Present', 'Present', 'Present', 'Present',
    ],
    // Pattern B: Average worker (some absences)
    patternB: [
      'Present', 'Present', 'Absent', 'Present', 'Present', 'Present',
      'Present', 'Half Day', 'Present', 'Present', 'Present', 'Present',
      'On Leave', 'On Leave', 'Present', 'Present', 'Present', 'Present',
      'Present', 'Present', 'Half Day', 'Present', 'Present', 'Present',
      'Absent', 'Present', 'Present', 'Present', 'Present', 'Present',
    ],
    // Pattern C: Irregular attendance
    patternC: [
      'Present', 'Present', 'Present', 'Absent', 'Present', 'Half Day',
      'Present', 'Present', 'On Leave', 'On Leave', 'On Leave', 'Present',
      'Present', 'Present', 'Absent', 'Present', 'Present', 'Present',
      'Half Day', 'Present', 'Present', 'Present', 'Absent', 'Present',
      'Present', 'Present', 'Present', 'Half Day', 'Present', 'Present',
    ],
    // Pattern D: Mostly present
    patternD: [
      'Present', 'Present', 'Present', 'Present', 'Present', 'Present',
      'Present', 'Present', 'Present', 'Present', 'Present', 'Present',
      'Present', 'Present', 'Present', 'Half Day', 'Present', 'Present',
      'Present', 'Present', 'Present', 'Present', 'Present', 'Present',
      'On Leave', 'Present', 'Present', 'Present', 'Present', 'Present',
    ],
  };

  const patternKeys = Object.keys(statusPatterns);

  // Check-in / check-out times for different statuses
  const timeMap: Record<string, { checkIn: string; checkOut: string }> = {
    'Present':   { checkIn: '09:00', checkOut: '18:00' },
    'Half Day':  { checkIn: '09:00', checkOut: '13:00' },
    'Absent':    { checkIn: '',       checkOut: '' },
    'On Leave':  { checkIn: '',       checkOut: '' },
  };

  let totalCreated = 0;
  let totalSkipped = 0;

  for (const staff of allStaff) {
    // Pick a pattern based on staff index
    const patternKey = patternKeys[allStaff.indexOf(staff) % patternKeys.length];
    const pattern = statusPatterns[patternKey];

    for (const monthInfo of monthsToSeed) {
      const daysInMonth = new Date(monthInfo.year, monthInfo.month, 0).getDate();

      // For current month, only seed up to today
      const today = new Date();
      const isCurrentMonth = monthInfo.year === today.getFullYear() && monthInfo.month === (today.getMonth() + 1);
      const lastDay = isCurrentMonth ? Math.min(today.getDate(), daysInMonth) : daysInMonth;

      for (let day = 1; day <= lastDay; day++) {
        const dateStr = `${monthInfo.year}-${String(monthInfo.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        // Skip Sundays (day of week = 0)
        const dayOfWeek = new Date(monthInfo.year, monthInfo.month - 1, day).getDay();
        if (dayOfWeek === 0) continue; // Skip Sunday

        const status = pattern[(day - 1) % pattern.length];
        const times = timeMap[status] || timeMap['Present'];

        // Check if record already exists
        const existing = await attendanceModel.findUnique({
          where: { staffId_dateStr: { staffId: staff.id, dateStr } }
        });

        if (existing) {
          totalSkipped++;
          continue;
        }

        await attendanceModel.create({
          data: {
            staffId: staff.id,
            dateStr,
            checkInTime: times.checkIn || null,
            checkOutTime: times.checkOut || null,
            status,
            remarks: status === 'On Leave' ? 'Personal leave' : (status === 'Absent' ? 'Absent without notice' : null),
          }
        });
        totalCreated++;
      }
    }

    console.log(`  ✓ ${staff.name} (${staff.staffCode}) — attendance seeded`);
  }

  console.log(`\n✅ Staff attendance seeding complete!`);
  console.log(`   Created: ${totalCreated} records`);
  console.log(`   Skipped: ${totalSkipped} (already existed)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
