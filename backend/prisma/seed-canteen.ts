import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedCanteen() {
  console.log('Clearing old Canteen products, purchases & categories...');

  // Delete existing purchases & products to clean up old default seed data
  await prisma.canteenPurchaseItem.deleteMany({});
  await prisma.canteenPurchase.deleteMany({});
  await prisma.canteenProduct.deleteMany({});
  await prisma.canteenCategory.deleteMany({});

  console.log('Seeding fresh Canteen default data...');

  // 1. Seed default payment modes
  // Clean up existing payment modes first to ensure only Cash and Credit remain
  await prisma.canteenPaymentMode.deleteMany({});
  const defaultModes = ['Cash', 'Credit'];
  for (const name of defaultModes) {
    await prisma.canteenPaymentMode.upsert({
      where: { name },
      update: {},
      create: { name, isSystem: true }
    });
  }

  // 2. Seed default units
  const defaultUnits = [
    { name: 'Kilogram', symbol: 'kg' },
    { name: 'Liter', symbol: 'ltr' },
    { name: 'Packet', symbol: 'pkt' },
    { name: 'Piece', symbol: 'pc' },
    { name: 'Box', symbol: 'box' },
    { name: 'Bottle', symbol: 'btl' },
    { name: 'Plate', symbol: 'plt' },
    { name: 'Cup', symbol: 'cup' },
    { name: 'Can', symbol: 'can' },
    { name: 'Gram', symbol: 'g' }
  ];
  for (const unit of defaultUnits) {
    await prisma.canteenUnit.upsert({
      where: { name: unit.name },
      update: { symbol: unit.symbol },
      create: { name: unit.name, symbol: unit.symbol }
    });
  }

  // 3. Seed exact Categories requested by user
  const categories = [
    {
      name: 'Rice & Rice Products',
      description: 'Ponni rice, boiled rice, raw rice, basmati rice'
    },
    {
      name: 'Dals & Pulses',
      description: 'Toor dal, urad dal, moong dal, chana dal'
    },
    {
      name: 'Flour & Rava',
      description: 'Wheat flour, maida, rava, rice flour'
    },
    {
      name: 'Oils & Ghee',
      description: 'Sunflower oil, groundnut oil, palm oil, ghee'
    },
    {
      name: 'Spices & Masala',
      description: 'Chilli powder, turmeric, coriander, pepper, cumin'
    },
    {
      name: 'Vegetables',
      description: 'Onion, tomato, potato, carrot, beans'
    },
    {
      name: 'Grocery Essentials',
      description: 'Sugar, salt, tamarind, jaggery, mustard seeds'
    },
    {
      name: 'Breakfast Items',
      description: 'Vermicelli, poha, rava, noodles'
    },
    {
      name: 'Dairy Products',
      description: 'Milk, curd, butter'
    },
    {
      name: 'Tea & Coffee',
      description: 'Tea powder, coffee powder'
    },
    {
      name: 'Cleaning Supplies',
      description: 'Dishwash liquid, floor cleaner, cleaning supplies'
    }
  ];

  const categoryMap = new Map<string, string>();
  for (const cat of categories) {
    const c = await prisma.canteenCategory.upsert({
      where: { name: cat.name },
      update: { description: cat.description },
      create: { name: cat.name, description: cat.description }
    });
    categoryMap.set(cat.name, c.id);
  }

  // 4. Seed Suppliers
  const suppliers = [
    { name: 'Lakshmi Wholesale Grocery Traders', phone: '9840112233', email: 'lakshmigrocery@gmail.com', address: '12 Wholesale Grain Market', gstNo: '33AAACL1234E1Z1' },
    { name: 'Annapoorna Merchants & Mills', phone: '9444055667', email: 'annapoornatraders@gmail.com', address: '45 Rice Mill Road', gstNo: '33BBBP09876K1Z9' },
    { name: 'Premier Oil & Spice Distributors', phone: '9789012345', email: 'premiergrain@gmail.com', address: '88 Oil Depot Complex' }
  ];

  for (const s of suppliers) {
    const existing = await prisma.canteenSupplier.findFirst({ where: { name: s.name } });
    if (!existing) {
      await prisma.canteenSupplier.create({ data: s });
    }
  }

  // 5. Units Map
  const unitMap = new Map<string, string>();
  const allUnits = await prisma.canteenUnit.findMany();
  allUnits.forEach(u => unitMap.set(u.name, u.id));

  // 6. Seed exact Sample Products requested by user
  const sampleProducts = [
    {
      name: 'Ponni Boiled Rice',
      code: 'P000001',
      categoryName: 'Rice & Rice Products',
      unitName: 'Kilogram',
      price: 55,
      costPrice: 48,

      status: 'Active'
    },
    {
      name: 'Raw Rice',
      code: 'P000002',
      categoryName: 'Rice & Rice Products',
      unitName: 'Kilogram',
      price: 50,
      costPrice: 44,

      status: 'Active'
    },
    {
      name: 'Toor Dal',
      code: 'P000003',
      categoryName: 'Dals & Pulses',
      unitName: 'Kilogram',
      price: 150,
      costPrice: 130,

      status: 'Active'
    },
    {
      name: 'Urad Dal',
      code: 'P000004',
      categoryName: 'Dals & Pulses',
      unitName: 'Kilogram',
      price: 120,
      costPrice: 105,

      status: 'Active'
    },
    {
      name: 'Moong Dal',
      code: 'P000005',
      categoryName: 'Dals & Pulses',
      unitName: 'Kilogram',
      price: 120,
      costPrice: 105,

      status: 'Active'
    },
    {
      name: 'Wheat Flour',
      code: 'P000006',
      categoryName: 'Flour & Rava',
      unitName: 'Kilogram',
      price: 45,
      costPrice: 38,

      status: 'Active'
    },
    {
      name: 'Rava',
      code: 'P000007',
      categoryName: 'Flour & Rava',
      unitName: 'Kilogram',
      price: 50,
      costPrice: 42,

      status: 'Active'
    },
    {
      name: 'Sunflower Oil',
      code: 'P000008',
      categoryName: 'Oils & Ghee',
      unitName: 'Liter',
      price: 150,
      costPrice: 135,

      status: 'Active'
    },
    {
      name: 'Turmeric Powder',
      code: 'P000009',
      categoryName: 'Spices & Masala',
      unitName: 'Kilogram',
      price: 250,
      costPrice: 220,

      status: 'Active'
    },
    {
      name: 'Chilli Powder',
      code: 'P000010',
      categoryName: 'Spices & Masala',
      unitName: 'Kilogram',
      price: 300,
      costPrice: 270,

      status: 'Active'
    },
    {
      name: 'Onion',
      code: 'P000011',
      categoryName: 'Vegetables',
      unitName: 'Kilogram',
      price: 40,
      costPrice: 30,

      status: 'Active'
    },
    {
      name: 'Tomato',
      code: 'P000012',
      categoryName: 'Vegetables',
      unitName: 'Kilogram',
      price: 35,
      costPrice: 25,

      status: 'Active'
    },
    {
      name: 'Potato',
      code: 'P000013',
      categoryName: 'Vegetables',
      unitName: 'Kilogram',
      price: 35,
      costPrice: 28,

      status: 'Active'
    },
    {
      name: 'Sugar',
      code: 'P000014',
      categoryName: 'Grocery Essentials',
      unitName: 'Kilogram',
      price: 50,
      costPrice: 44,

      status: 'Active'
    },
    {
      name: 'Salt',
      code: 'P000015',
      categoryName: 'Grocery Essentials',
      unitName: 'Kilogram',
      price: 25,
      costPrice: 20,

      status: 'Active'
    },
    {
      name: 'Tamarind',
      code: 'P000016',
      categoryName: 'Grocery Essentials',
      unitName: 'Kilogram',
      price: 180,
      costPrice: 150,

      status: 'Active'
    },
    {
      name: 'Milk',
      code: 'P000017',
      categoryName: 'Dairy Products',
      unitName: 'Liter',
      price: 60,
      costPrice: 54,

      status: 'Active'
    },
    {
      name: 'Tea Powder',
      code: 'P000018',
      categoryName: 'Tea & Coffee',
      unitName: 'Kilogram',
      price: 350,
      costPrice: 300,

      status: 'Active'
    },
    {
      name: 'Coffee Powder',
      code: 'P000019',
      categoryName: 'Tea & Coffee',
      unitName: 'Kilogram',
      price: 450,
      costPrice: 400,

      status: 'Active'
    },
    {
      name: 'Dishwash Liquid',
      code: 'P000020',
      categoryName: 'Cleaning Supplies',
      unitName: 'Liter',
      price: 120,
      costPrice: 95,

      status: 'Active'
    }
  ];

  for (const p of sampleProducts) {
    const catId = categoryMap.get(p.categoryName) || null;
    const uId = unitMap.get(p.unitName) || null;

    await prisma.canteenProduct.create({
      data: {
        name: p.name,
        code: p.code,
        categoryId: catId,
        unitId: uId,
        price: p.price,
        costPrice: p.costPrice,

        status: p.status
      }
    });
  }

  console.log('Canteen seeding completed successfully! Only requested items seeded.');
}

seedCanteen()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
