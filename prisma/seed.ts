import {
  DebtStatus,
  DebtType,
  OrganizationKind,
  OrganizationMembershipStatus,
  OrganizationRole,
  PartyType,
  PaymentMethod,
  Prisma,
  PrismaClient,
  SystemRole,
} from '../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { loadEnvFile } from 'node:process';
import * as bcrypt from 'bcryptjs';
import { partySearchText } from '../src/common/utils/search-normalization.util';
loadEnvFile('.env');
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required to seed the database.');
const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl) });
const password = 'Demo@123456';

type CoolmateDebtSeedRow = {
  code: string;
  type: DebtType;
  title: string;
  amount: string;
  paid: string;
  issue: string;
  due: string;
  status: DebtStatus;
  item?: {
    product: { id: string; code: string; name: string; unit: string };
    category: { name: string };
    brand: { name: string };
    quantity: number;
  };
};
async function user(email: string, name: string, systemRole: SystemRole = SystemRole.USER) {
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, systemRole, status: 'ACTIVE' },
    create: { email, name, passwordHash, systemRole, status: 'ACTIVE' },
  });
}
async function org(slug: string, name: string, kind: OrganizationKind, createdById: string) {
  return prisma.organization.upsert({
    where: { slug },
    update: { name, kind, status: 'ACTIVE', createdById },
    create: { slug, name, kind, status: 'ACTIVE', createdById },
  });
}
async function member(organizationId: string, userId: string, role: OrganizationRole) {
  return prisma.organizationMembership.upsert({
    where: { organizationId_userId: { organizationId, userId } },
    update: { role, status: OrganizationMembershipStatus.ACTIVE, joinedAt: new Date() },
    create: {
      organizationId,
      userId,
      role,
      status: OrganizationMembershipStatus.ACTIVE,
      joinedAt: new Date(),
    },
  });
}
async function main() {
  await user('admin@debtflow.local', 'Debt Flow Platform Owner', SystemRole.PLATFORM_OWNER);
  const ownerA = await user('owner@anphu-fashion.demo', 'Nguyễn An - Chủ shop');
  const accountantA = await user('accountant@anphu-fashion.demo', 'Trần Mai - Kế toán');
  const viewerA = await user('viewer@anphu-fashion.demo', 'Lê Minh - Nhân viên xem');
  const ownerB = await user('owner@b-minimal.demo', 'Phạm Bình - Chủ shop B');
  const personal = await user('linh@linh-store.demo', 'Nguyễn Linh - Shop cá nhân');
  const shopA = await org('an-phu-fashion', 'An Phú Fashion', OrganizationKind.BUSINESS, ownerA.id);
  const shopB = await org(
    'b-minimal-store',
    'B Minimal Store',
    OrganizationKind.BUSINESS,
    ownerB.id,
  );
  const shopC = await org(
    'linh-personal-store',
    'Linh Personal Store',
    OrganizationKind.PERSONAL,
    personal.id,
  );
  await Promise.all([
    member(shopA.id, ownerA.id, OrganizationRole.OWNER),
    member(shopA.id, accountantA.id, OrganizationRole.ACCOUNTANT),
    member(shopA.id, viewerA.id, OrganizationRole.VIEWER),
    member(shopB.id, ownerB.id, OrganizationRole.OWNER),
    member(shopC.id, personal.id, OrganizationRole.OWNER),
  ]);
  const category = await prisma.category.upsert({
    where: { organizationId_code: { organizationId: shopA.id, code: 'APPAREL' } },
    update: { name: 'Quần áo', isActive: true },
    create: { organizationId: shopA.id, code: 'APPAREL', name: 'Quần áo', sortOrder: 10 },
  });
  const brand = await prisma.brand.upsert({
    where: { organizationId_code: { organizationId: shopA.id, code: 'COOLMATE' } },
    update: { name: 'Coolmate', isActive: true },
    create: { organizationId: shopA.id, code: 'COOLMATE', name: 'Coolmate' },
  });
  const product = await prisma.product.upsert({
    where: { organizationId_code: { organizationId: shopA.id, code: 'TSHIRT-COTTON' } },
    update: { name: 'Áo thun cotton basic', categoryId: category.id, brandId: brand.id },
    create: {
      organizationId: shopA.id,
      code: 'TSHIRT-COTTON',
      name: 'Áo thun cotton basic',
      categoryId: category.id,
      brandId: brand.id,
      unit: 'Áo',
    },
  });
  const customer = await prisma.party.upsert({
    where: { organizationId_code: { organizationId: shopA.id, code: 'CUS-MOC-LAN' } },
    update: {
      name: 'Cửa hàng Mộc Lan Wholesale',
      searchText: partySearchText('Cửa hàng Mộc Lan Wholesale', 'CUS-MOC-LAN', '0908123456'),
      type: PartyType.CUSTOMER,
    },
    create: {
      organizationId: shopA.id,
      code: 'CUS-MOC-LAN',
      name: 'Cửa hàng Mộc Lan Wholesale',
      searchText: partySearchText('Cửa hàng Mộc Lan Wholesale', 'CUS-MOC-LAN', '0908123456'),
      type: PartyType.CUSTOMER,
      phone: '0908123456',
      provinceCode: 'HCM',
      provinceName: 'TP. Hồ Chí Minh',
      createdById: ownerA.id,
      assignedToId: accountantA.id,
    },
  });
  const supplier = await prisma.party.upsert({
    where: { organizationId_code: { organizationId: shopA.id, code: 'SUP-MINH-AN' } },
    update: {
      name: 'Nhà phân phối Minh An',
      searchText: partySearchText('Nhà phân phối Minh An', 'SUP-MINH-AN', '02873001234'),
      type: PartyType.SUPPLIER,
    },
    create: {
      organizationId: shopA.id,
      code: 'SUP-MINH-AN',
      name: 'Nhà phân phối Minh An',
      searchText: partySearchText('Nhà phân phối Minh An', 'SUP-MINH-AN', '02873001234'),
      type: PartyType.SUPPLIER,
      phone: '02873001234',
      provinceCode: 'HCM',
      provinceName: 'TP. Hồ Chí Minh',
      createdById: ownerA.id,
      assignedToId: accountantA.id,
    },
  });
  const debts = [
    {
      code: 'INV-ANPHU-0901',
      party: customer,
      type: DebtType.RECEIVABLE,
      title: 'Bán sỉ áo thun đợt 1',
      amount: '2000000',
      due: '2026-09-10',
    },
    {
      code: 'INV-ANPHU-0902',
      party: customer,
      type: DebtType.RECEIVABLE,
      title: 'Bán sỉ áo thun đợt 2',
      amount: '3000000',
      due: '2026-09-20',
    },
    {
      code: 'BILL-ANPHU-0901',
      party: supplier,
      type: DebtType.PAYABLE,
      title: 'Nhập hàng thời trang tháng 9',
      amount: '12000000',
      due: '2026-09-15',
    },
  ];
  const created = [] as Array<{ id: string; originalAmount: Prisma.Decimal }>;
  for (const row of debts) {
    const debt = await prisma.debt.upsert({
      where: { organizationId_code: { organizationId: shopA.id, code: row.code } },
      update: {
        partyId: row.party.id,
        type: row.type,
        title: row.title,
        originalAmount: new Prisma.Decimal(row.amount),
        dueDate: new Date(row.due),
        issueDate: new Date('2026-09-01'),
      },
      create: {
        organizationId: shopA.id,
        code: row.code,
        partyId: row.party.id,
        type: row.type,
        title: row.title,
        originalAmount: new Prisma.Decimal(row.amount),
        issueDate: new Date('2026-09-01'),
        dueDate: new Date(row.due),
        createdById: ownerA.id,
        assignedToId: accountantA.id,
        items: {
          create: {
            productId: product.id,
            productCode: product.code,
            productName: product.name,
            categoryName: category.name,
            brandName: brand.name,
            quantity: new Prisma.Decimal(1),
            unit: 'Lô',
            unitPrice: new Prisma.Decimal(row.amount),
            lineAmount: new Prisma.Decimal(row.amount),
          },
        },
      },
    });
    created.push(debt);
  }
  await prisma.payment.upsert({
    where: { id: 'seed-anphu-receipt-4000000' },
    update: {
      organizationId: shopA.id,
      partyId: customer.id,
      type: DebtType.RECEIVABLE,
      amount: new Prisma.Decimal('4000000'),
      paidAt: new Date('2026-09-04'),
      allocations: {
        deleteMany: {},
        create: [
          { debtId: created[0].id, amount: new Prisma.Decimal('2000000') },
          { debtId: created[1].id, amount: new Prisma.Decimal('2000000') },
        ],
      },
    },
    create: {
      id: 'seed-anphu-receipt-4000000',
      organizationId: shopA.id,
      partyId: customer.id,
      type: DebtType.RECEIVABLE,
      amount: new Prisma.Decimal('4000000'),
      paidAt: new Date('2026-09-04'),
      method: PaymentMethod.BANK_TRANSFER,
      createdById: accountantA.id,
      allocations: {
        create: [
          { debtId: created[0].id, amount: new Prisma.Decimal('2000000') },
          { debtId: created[1].id, amount: new Prisma.Decimal('2000000') },
        ],
      },
    },
  });
  await prisma.debt.update({
    where: { id: created[0].id },
    data: { paidAmount: new Prisma.Decimal('2000000'), status: DebtStatus.PAID },
  });
  await prisma.debt.update({
    where: { id: created[1].id },
    data: { paidAmount: new Prisma.Decimal('2000000'), status: DebtStatus.PARTIAL },
  });

  // The debt overview uses these 28 partners plus the two core fixtures above.
  // Keep this data in An Phú Fashion because that is the default demo workspace.
  const shopAPartnerDebtFixtures = [
    ...[
      'Cửa hàng Ánh Dương',
      'Boutique Lụa Việt',
      'Hệ thống Mặc Đẹp',
      'Thời trang Nam Phong',
      'Cửa hàng Denim House',
      'Urban Wardrobe',
      'May mặc Sông Hồng',
      'Thời trang Mộc Miên',
      'Cửa hàng Linen & Co.',
      'Thời trang Phố Mới',
      'Cửa hàng Ngà Fashion',
      'Boutique An Nhiên',
      'Cửa hàng Forme',
      'Nhà bán lẻ Nét Việt',
    ].map((name, index) => ({
      amount: 4200000 + index * 375000,
      code: 'CUS-A-APPAREL-' + String(index + 1).padStart(2, '0'),
      debtType: DebtType.RECEIVABLE,
      name,
      type: PartyType.CUSTOMER,
    })),
    ...[
      'Nhà phân phối Giày Việt',
      'Kho giày Sài Thành',
      'Công ty Da giày Đông Nam',
      'Nhà cung cấp Step Up',
      'Xưởng giày Bình An',
      'Phân phối Sneaker Hub',
      'Công ty Giày dép Thành Công',
      'Kho hàng Footwear Pro',
      'Nhà cung cấp Urban Steps',
      'Xưởng sản xuất Lạc Việt',
      'Phân phối Sole & Lace',
      'Công ty Giày thể thao Phương Nam',
      'Kho dép Sandal Việt',
      'Nhà phân phối Ngã Bảy',
    ].map((name, index) => ({
      amount: 7800000 + index * 525000,
      code: 'SUP-A-FOOTWEAR-' + String(index + 1).padStart(2, '0'),
      debtType: DebtType.PAYABLE,
      name,
      type: PartyType.SUPPLIER,
    })),
  ];

  for (const [index, fixture] of shopAPartnerDebtFixtures.entries()) {
    const phone = '0283' + String(910000 + index).padStart(6, '0');
    const party = await prisma.party.upsert({
      where: { organizationId_code: { organizationId: shopA.id, code: fixture.code } },
      update: {
        name: fixture.name,
        phone,
        searchText: partySearchText(fixture.name, fixture.code, phone),
        type: fixture.type,
      },
      create: {
        organizationId: shopA.id,
        code: fixture.code,
        name: fixture.name,
        phone,
        provinceCode: 'HCM',
        provinceName: 'TP. Hồ Chí Minh',
        searchText: partySearchText(fixture.name, fixture.code, phone),
        type: fixture.type,
        createdById: ownerA.id,
        assignedToId: accountantA.id,
      },
    });
    const amount = new Prisma.Decimal(fixture.amount);
    const debtCode =
      (fixture.debtType === DebtType.RECEIVABLE ? 'INV' : 'BILL') +
      '-A-PARTNER-' +
      String(index + 1).padStart(3, '0');

    await prisma.debt.upsert({
      where: { organizationId_code: { organizationId: shopA.id, code: debtCode } },
      update: {
        dueDate: new Date('2026-10-' + String((index % 20) + 1).padStart(2, '0')),
        issueDate: new Date('2026-09-' + String((index % 20) + 1).padStart(2, '0')),
        originalAmount: amount,
        paidAmount: new Prisma.Decimal(0),
        partyId: party.id,
        status: DebtStatus.OPEN,
        title:
          (fixture.debtType === DebtType.RECEIVABLE ? 'Bán sỉ thời trang' : 'Nhập hàng') +
          ' - ' +
          fixture.name,
        type: fixture.debtType,
      },
      create: {
        organizationId: shopA.id,
        code: debtCode,
        dueDate: new Date('2026-10-' + String((index % 20) + 1).padStart(2, '0')),
        issueDate: new Date('2026-09-' + String((index % 20) + 1).padStart(2, '0')),
        originalAmount: amount,
        partyId: party.id,
        status: DebtStatus.OPEN,
        title:
          (fixture.debtType === DebtType.RECEIVABLE ? 'Bán sỉ thời trang' : 'Nhập hàng') +
          ' - ' +
          fixture.name,
        type: fixture.debtType,
        createdById: ownerA.id,
        assignedToId: accountantA.id,
      },
    });
  }
  const bParty = await prisma.party.upsert({
    where: { organizationId_code: { organizationId: shopB.id, code: 'CUS-B-MINIMAL' } },
    update: {
      name: 'Coolmate',
      searchText: partySearchText('Coolmate', 'CUS-B-MINIMAL', '02839998899'),
      type: PartyType.BOTH,
      phone: '02839998899',
      provinceCode: 'HCM',
      provinceName: 'TP. Hồ Chí Minh',
      address: 'Quận 3, TP. Hồ Chí Minh',
    },
    create: {
      organizationId: shopB.id,
      code: 'CUS-B-MINIMAL',
      name: 'Coolmate',
      searchText: partySearchText('Coolmate', 'CUS-B-MINIMAL', '02839998899'),
      type: PartyType.BOTH,
      phone: '02839998899',
      provinceCode: 'HCM',
      provinceName: 'TP. Hồ Chí Minh',
      address: 'Quận 3, TP. Hồ Chí Minh',
      createdById: ownerB.id,
    },
  });
  await prisma.debt.updateMany({
    where: { organizationId: shopB.id, code: 'INV-B-001' },
    data: {
      code: 'INV-COOLMATE-2026-001',
      partyId: bParty.id,
      title: 'Đơn hàng đồng phục Coolmate - đợt 01',
    },
  });
  const shopBApparelCategory = await prisma.category.upsert({
    where: { organizationId_code: { organizationId: shopB.id, code: 'APPAREL' } },
    update: { name: 'Quần áo', isActive: true },
    create: { organizationId: shopB.id, code: 'APPAREL', name: 'Quần áo', sortOrder: 10 },
  });
  const shopBFootwearCategory = await prisma.category.upsert({
    where: { organizationId_code: { organizationId: shopB.id, code: 'FOOTWEAR' } },
    update: { name: 'Giày dép', isActive: true },
    create: { organizationId: shopB.id, code: 'FOOTWEAR', name: 'Giày dép', sortOrder: 20 },
  });
  const shopBCoolmateBrand = await prisma.brand.upsert({
    where: { organizationId_code: { organizationId: shopB.id, code: 'COOLMATE' } },
    update: { name: 'Coolmate', isActive: true },
    create: { organizationId: shopB.id, code: 'COOLMATE', name: 'Coolmate' },
  });
  const shopBApparelProduct = await prisma.product.upsert({
    where: { organizationId_code: { organizationId: shopB.id, code: 'COOLMATE-TEE' } },
    update: {
      name: 'Áo thun cotton Coolmate',
      categoryId: shopBApparelCategory.id,
      brandId: shopBCoolmateBrand.id,
    },
    create: {
      organizationId: shopB.id,
      code: 'COOLMATE-TEE',
      name: 'Áo thun cotton Coolmate',
      categoryId: shopBApparelCategory.id,
      brandId: shopBCoolmateBrand.id,
      unit: 'Áo',
    },
  });
  const shopBFootwearProduct = await prisma.product.upsert({
    where: { organizationId_code: { organizationId: shopB.id, code: 'COOLMATE-SNEAKER' } },
    update: {
      name: 'Giày sneaker Coolmate',
      categoryId: shopBFootwearCategory.id,
      brandId: shopBCoolmateBrand.id,
    },
    create: {
      organizationId: shopB.id,
      code: 'COOLMATE-SNEAKER',
      name: 'Giày sneaker Coolmate',
      categoryId: shopBFootwearCategory.id,
      brandId: shopBCoolmateBrand.id,
      unit: 'Đôi',
    },
  });
  const coolmateDebts: CoolmateDebtSeedRow[] = [
    ...Array.from({ length: 20 }, (_, index) => {
      const n = index + 1;
      const amount = 3000000 + n * 450000;
      const paid = n % 5 === 0 ? amount : n % 3 === 0 ? Math.round(amount * 0.4) : 0;
      return {
        code: 'INV-COOLMATE-2026-' + String(n).padStart(3, '0'),
        type: DebtType.RECEIVABLE,
        title: 'Đơn hàng thời trang Coolmate - đợt ' + String(n).padStart(2, '0'),
        amount: String(amount),
        paid: String(paid),
        issue: '2026-' + String((n % 9) + 1).padStart(2, '0') + '-05',
        due: '2026-' + String((n % 9) + 1).padStart(2, '0') + '-25',
        status: paid === amount ? DebtStatus.PAID : paid > 0 ? DebtStatus.PARTIAL : DebtStatus.OPEN,
      };
    }),
    ...Array.from({ length: 10 }, (_, index) => {
      const n = index + 1;
      const amount = 8000000 + n * 750000;
      const paid = n % 4 === 0 ? amount : n % 3 === 0 ? Math.round(amount * 0.35) : 0;
      return {
        code: 'BILL-COOLMATE-2026-' + String(n).padStart(3, '0'),
        type: DebtType.PAYABLE,
        title: 'Nhập hàng Coolmate - đợt ' + String(n).padStart(2, '0'),
        amount: String(amount),
        paid: String(paid),
        issue: '2026-' + String((n % 9) + 1).padStart(2, '0') + '-08',
        due: '2026-' + String((n % 9) + 1).padStart(2, '0') + '-28',
        status: paid === amount ? DebtStatus.PAID : paid > 0 ? DebtStatus.PARTIAL : DebtStatus.OPEN,
      };
    }),
    ...Array.from({ length: 10 }, (_, index) => {
      const n = index + 21;
      const amount = 5200000 + index * 325000;
      const paid = n % 4 === 0 ? amount : n % 3 === 0 ? Math.round(amount * 0.5) : 0;
      return {
        code: 'INV-COOLMATE-2026-' + String(n).padStart(3, '0'),
        type: DebtType.RECEIVABLE,
        title: 'Bán sỉ áo thun cotton Coolmate - đợt ' + String(index + 1).padStart(2, '0'),
        amount: String(amount),
        paid: String(paid),
        issue: '2026-' + String((index % 9) + 1).padStart(2, '0') + '-12',
        due: '2026-' + String((index % 9) + 1).padStart(2, '0') + '-30',
        status: paid === amount ? DebtStatus.PAID : paid > 0 ? DebtStatus.PARTIAL : DebtStatus.OPEN,
        item: {
          product: shopBApparelProduct,
          category: shopBApparelCategory,
          brand: shopBCoolmateBrand,
          quantity: 20 + index * 5,
        },
      };
    }),
    ...Array.from({ length: 10 }, (_, index) => {
      const n = index + 11;
      const amount = 9700000 + index * 650000;
      const paid = n % 4 === 0 ? amount : n % 3 === 0 ? Math.round(amount * 0.35) : 0;
      return {
        code: 'BILL-COOLMATE-2026-' + String(n).padStart(3, '0'),
        type: DebtType.PAYABLE,
        title: 'Nhập giày sneaker Coolmate - đợt ' + String(index + 1).padStart(2, '0'),
        amount: String(amount),
        paid: String(paid),
        issue: '2026-' + String((index % 9) + 1).padStart(2, '0') + '-16',
        due: '2026-' + String((index % 9) + 1).padStart(2, '0') + '-29',
        status: paid === amount ? DebtStatus.PAID : paid > 0 ? DebtStatus.PARTIAL : DebtStatus.OPEN,
        item: {
          product: shopBFootwearProduct,
          category: shopBFootwearCategory,
          brand: shopBCoolmateBrand,
          quantity: 10 + index * 2,
        },
      };
    }),
  ];
  for (const row of coolmateDebts) {
    const debtItem = row.item;
    const debtItemData = debtItem
      ? {
          productId: debtItem.product.id,
          productCode: debtItem.product.code,
          productName: debtItem.product.name,
          categoryName: debtItem.category.name,
          brandName: debtItem.brand.name,
          quantity: new Prisma.Decimal(debtItem.quantity),
          unit: debtItem.product.unit,
          unitPrice: new Prisma.Decimal(row.amount).div(debtItem.quantity),
          lineAmount: new Prisma.Decimal(row.amount),
        }
      : undefined;
    const debt = await prisma.debt.upsert({
      where: { organizationId_code: { organizationId: shopB.id, code: row.code } },
      update: {
        partyId: bParty.id,
        type: row.type,
        title: row.title,
        originalAmount: new Prisma.Decimal(row.amount),
        paidAmount: new Prisma.Decimal(row.paid),
        issueDate: new Date(row.issue),
        dueDate: new Date(row.due),
        status: row.status,
        items: debtItemData
          ? {
              deleteMany: {},
              create: debtItemData,
            }
          : undefined,
      },
      create: {
        organizationId: shopB.id,
        code: row.code,
        partyId: bParty.id,
        type: row.type,
        title: row.title,
        originalAmount: new Prisma.Decimal(row.amount),
        paidAmount: new Prisma.Decimal(row.paid),
        issueDate: new Date(row.issue),
        dueDate: new Date(row.due),
        status: row.status,
        createdById: ownerB.id,
        items: debtItemData ? { create: debtItemData } : undefined,
      },
    });
    if (Number(row.paid) > 0) {
      const paymentId = 'seed-coolmate-' + row.code;
      await prisma.payment.upsert({
        where: { id: paymentId },
        update: {
          organizationId: shopB.id,
          partyId: bParty.id,
          type: row.type,
          amount: new Prisma.Decimal(row.paid),
          paidAt: new Date(row.issue),
          method: PaymentMethod.BANK_TRANSFER,
          createdById: ownerB.id,
          allocations: {
            deleteMany: {},
            create: { debtId: debt.id, amount: new Prisma.Decimal(row.paid) },
          },
        },
        create: {
          id: paymentId,
          organizationId: shopB.id,
          partyId: bParty.id,
          type: row.type,
          amount: new Prisma.Decimal(row.paid),
          paidAt: new Date(row.issue),
          method: PaymentMethod.BANK_TRANSFER,
          createdById: ownerB.id,
          allocations: { create: { debtId: debt.id, amount: new Prisma.Decimal(row.paid) } },
        },
      });
    }
  }
  const shopBPartnerDebtFixtures = [
    ...[
      'Cửa hàng Thời trang Ánh Dương',
      'Boutique Lụa Việt',
      'Hệ thống Mặc Đẹp',
      'Thời trang Nam Phong',
      'Cửa hàng Denim House',
      'Urban Wardrobe',
      'May mặc Sông Hồng',
      'Thời trang Mộc Miên',
      'Cửa hàng Linen & Co.',
      'Thời trang Phố Mới',
      'Nhà bán lẻ The Basic',
      'Cửa hàng Nét Việt',
      'Thời trang Mây Trắng',
      'Boutique An Nhiên',
      'Cửa hàng Forme',
    ].map((name, index) => ({
      code: 'CUS-B-APPAREL-' + String(index + 1).padStart(2, '0'),
      name,
      type: PartyType.CUSTOMER,
      debtType: DebtType.RECEIVABLE,
      segment: 'apparel' as const,
      amount: 4200000 + index * 375000,
    })),
    ...[
      'Nhà phân phối Giày Việt',
      'Kho giày Sài Thành',
      'Công ty Da giày Đông Nam',
      'Nhà cung cấp Step Up',
      'Xưởng giày Bình An',
      'Phân phối Sneaker Hub',
      'Công ty Giày dép Thành Công',
      'Kho hàng Footwear Pro',
      'Nhà cung cấp Urban Steps',
      'Xưởng sản xuất Lạc Việt',
      'Phân phối Sole & Lace',
      'Công ty Giày thể thao Phương Nam',
      'Kho dép Sandal Việt',
      'Nhà cung cấp Streetwear Shoes',
    ].map((name, index) => ({
      code: 'SUP-B-FOOTWEAR-' + String(index + 1).padStart(2, '0'),
      name,
      type: PartyType.SUPPLIER,
      debtType: DebtType.PAYABLE,
      segment: 'footwear' as const,
      amount: 7800000 + index * 525000,
    })),
  ];

  for (const [index, fixture] of shopBPartnerDebtFixtures.entries()) {
    const phone = '0283' + String(900000 + index).padStart(6, '0');
    const party = await prisma.party.upsert({
      where: { organizationId_code: { organizationId: shopB.id, code: fixture.code } },
      update: {
        name: fixture.name,
        type: fixture.type,
        isActive: true,
        phone,
        searchText: partySearchText(fixture.name, fixture.code, phone),
      },
      create: {
        organizationId: shopB.id,
        code: fixture.code,
        name: fixture.name,
        type: fixture.type,
        phone,
        provinceCode: 'HCM',
        provinceName: 'TP. Hồ Chí Minh',
        searchText: partySearchText(fixture.name, fixture.code, phone),
        createdById: ownerB.id,
      },
    });
    const isApparel = fixture.segment === 'apparel';
    const product = isApparel ? shopBApparelProduct : shopBFootwearProduct;
    const category = isApparel ? shopBApparelCategory : shopBFootwearCategory;
    const quantity = isApparel ? 24 + index * 2 : 12 + index;
    const debtCode =
      (isApparel ? 'INV' : 'BILL') + '-B-PARTNER-' + String(index + 1).padStart(3, '0');
    const amount = new Prisma.Decimal(fixture.amount);

    await prisma.debt.upsert({
      where: { organizationId_code: { organizationId: shopB.id, code: debtCode } },
      update: {
        partyId: party.id,
        type: fixture.debtType,
        title: (isApparel ? 'Bán sỉ quần áo' : 'Nhập hàng giày dép') + ' - ' + fixture.name,
        originalAmount: amount,
        paidAmount: new Prisma.Decimal(0),
        issueDate: new Date('2026-09-' + String((index % 20) + 1).padStart(2, '0')),
        dueDate: new Date('2026-10-' + String((index % 20) + 1).padStart(2, '0')),
        status: DebtStatus.OPEN,
        items: {
          deleteMany: {},
          create: {
            productId: product.id,
            productCode: product.code,
            productName: product.name,
            categoryName: category.name,
            brandName: shopBCoolmateBrand.name,
            quantity: new Prisma.Decimal(quantity),
            unit: product.unit,
            unitPrice: amount.div(quantity),
            lineAmount: amount,
          },
        },
      },
      create: {
        organizationId: shopB.id,
        code: debtCode,
        partyId: party.id,
        type: fixture.debtType,
        title: (isApparel ? 'Bán sỉ quần áo' : 'Nhập hàng giày dép') + ' - ' + fixture.name,
        originalAmount: amount,
        paidAmount: new Prisma.Decimal(0),
        issueDate: new Date('2026-09-' + String((index % 20) + 1).padStart(2, '0')),
        dueDate: new Date('2026-10-' + String((index % 20) + 1).padStart(2, '0')),
        status: DebtStatus.OPEN,
        createdById: ownerB.id,
        items: {
          create: {
            productId: product.id,
            productCode: product.code,
            productName: product.name,
            categoryName: category.name,
            brandName: shopBCoolmateBrand.name,
            quantity: new Prisma.Decimal(quantity),
            unit: product.unit,
            unitPrice: amount.div(quantity),
            lineAmount: amount,
          },
        },
      },
    });
  }

  console.log('Seeded organizations and users. Password for all demo users: ' + password);
  console.log({
    platform: 'admin@debtflow.local',
    shopA: [
      'owner@anphu-fashion.demo',
      'accountant@anphu-fashion.demo',
      'viewer@anphu-fashion.demo',
    ],
    shopB: 'owner@b-minimal.demo',
    personal: 'linh@linh-store.demo',
  });
}
main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
