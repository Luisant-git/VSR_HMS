import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const staffModel = (prisma as any).staff;
  const count = await staffModel.count();
  if (count > 0) {
    console.log(`Staff table already has ${count} records. Skipping seed.`);
    return;
  }

  const initialStaff = [
    {
      staffCode: 'STF-001',
      name: 'K. Ramalingam',
      role: 'Gate Security Guard',
      phone: '9842156780',
      email: 'ramalingam.k@gmail.com',
      salaryBasis: 'Monthly Fixed',
      baseSalary: 35000.00,
      joiningDate: new Date('2024-01-15'),
      status: 'Active'
    },
    {
      staffCode: 'STF-002',
      name: 'Selvi Meenakshi',
      role: 'Hostel Warden',
      phone: '9443217890',
      email: 'meenakshi.warden@gmail.com',
      salaryBasis: 'Monthly Fixed',
      baseSalary: 22000.00,
      joiningDate: new Date('2024-06-01'),
      status: 'Active'
    },
    {
      staffCode: 'STF-003',
      name: 'M. Velusamy',
      role: 'Head Canteen Cook',
      phone: '9789045612',
      email: 'velusamy.mess@gmail.com',
      salaryBasis: 'Monthly Fixed',
      baseSalary: 25000.00,
      joiningDate: new Date('2024-08-10'),
      status: 'Active'
    },
    {
      staffCode: 'STF-004',
      name: 'D. Murugan',
      role: 'Maintenance & Electrician',
      phone: '9629123456',
      email: 'murugan.maint@gmail.com',
      salaryBasis: 'Monthly Fixed',
      baseSalary: 16000.00,
      joiningDate: new Date('2025-02-01'),
      status: 'Active'
    }
  ];

  for (const staff of initialStaff) {
    await staffModel.create({ data: staff });
  }

  console.log('✅ Successfully seeded 4 initial staff members (STF-001 to STF-004)!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
