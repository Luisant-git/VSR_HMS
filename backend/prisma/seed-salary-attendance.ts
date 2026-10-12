import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Seeding Staff & Salary Disbursement Samples ---');

  // 1. Ensure staff members exist
  let staff1 = await prisma.staff.findUnique({ where: { staffCode: 'STF-001' } });
  if (!staff1) {
    staff1 = await prisma.staff.create({
      data: {
        staffCode: 'STF-001',
        name: 'K. Ramalingam',
        role: 'Hostel Warden',
        phone: '9842156780',
        email: 'ramalingam.k@gmail.com',
        salaryBasis: 'Monthly Fixed',
        baseSalary: 35000.0,
        joiningDate: new Date('2024-01-15'),
        status: 'Active'
      }
    });
  } else {
    // Ensure role is Hostel Warden and salary is 35000 to match screenshot
    await prisma.staff.update({
      where: { id: staff1.id },
      data: { role: 'Hostel Warden', baseSalary: 35000.0 }
    });
  }

  let staff2 = await prisma.staff.findUnique({ where: { staffCode: 'STF-002' } });
  if (!staff2) {
    staff2 = await prisma.staff.create({
      data: {
        staffCode: 'STF-002',
        name: 'Selvi Meenakshi',
        role: 'Assistant Warden',
        phone: '9443217890',
        email: 'meenakshi.warden@gmail.com',
        salaryBasis: 'Monthly Fixed',
        baseSalary: 22000.0,
        joiningDate: new Date('2024-06-01'),
        status: 'Active'
      }
    });
  }

  let staff3 = await prisma.staff.findUnique({ where: { staffCode: 'STF-003' } });
  if (!staff3) {
    staff3 = await prisma.staff.create({
      data: {
        staffCode: 'STF-003',
        name: 'M. Velusamy',
        role: 'Head Canteen Cook',
        phone: '9789045612',
        email: 'velusamy.mess@gmail.com',
        salaryBasis: 'Monthly Fixed',
        baseSalary: 25000.0,
        joiningDate: new Date('2024-08-10'),
        status: 'Active'
      }
    });
  }

  // 2. Delete outdated records if any to avoid schema mismatch
  await (prisma as any).staffSalary.deleteMany({});

  // 3. Create Sample Salary Disbursement matching screenshot exactly:
  // K. Ramalingam (STF-001), October 2026, ₹35,000.00 net disbursed, Direct Bank Transfer
  await (prisma as any).staffSalary.create({
    data: {
      salaryCode: 'SAL-202610-001',
      staffId: staff1.id,
      salaryMonth: '2026-10',
      year: 2026,
      month: 'October',
      baseSalary: 35000.0,
      bonus: 0.0,
      deductions: 0.0,
      netAmount: 35000.0,
      paymentDate: new Date('2026-10-12'),
      paymentMode: 'Direct Bank Transfer',
      remarks: 'October salary disbursed to bank account',
      createdBy: 'System Administrator'
    }
  });

  // Sample 2: Selvi Meenakshi (STF-002), September 2026
  await (prisma as any).staffSalary.create({
    data: {
      salaryCode: 'SAL-202609-001',
      staffId: staff2.id,
      salaryMonth: '2026-09',
      year: 2026,
      month: 'September',
      baseSalary: 22000.0,
      bonus: 1000.0,
      deductions: 500.0,
      netAmount: 22500.0,
      paymentDate: new Date('2026-09-30'),
      paymentMode: 'Direct Bank Transfer',
      remarks: 'Festival bonus included',
      createdBy: 'System Administrator'
    }
  });

  // Sample 3: M. Velusamy (STF-003), September 2026
  await (prisma as any).staffSalary.create({
    data: {
      salaryCode: 'SAL-202609-002',
      staffId: staff3.id,
      salaryMonth: '2026-09',
      year: 2026,
      month: 'September',
      baseSalary: 25000.0,
      bonus: 0.0,
      deductions: 0.0,
      netAmount: 25000.0,
      paymentDate: new Date('2026-09-30'),
      paymentMode: 'Cash',
      remarks: 'September cash payout',
      createdBy: 'System Administrator'
    }
  });

  console.log('✅ Successfully seeded salary disbursements matching screenshot!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
