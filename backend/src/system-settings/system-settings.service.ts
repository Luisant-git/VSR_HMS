import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

const DEFAULT_SETTINGS = {
  hostelName: 'HOSTEL MANAGEMENT SYSTEM',
  address: '123 University Road, City Campus\nState, ZIP 12345',
  phone: '+91 98765 43210',
  email: 'info@hostel.com',
  gstin: '22AAAAA0000A1Z5'
};

@Injectable()
export class SystemSettingsService {
  constructor(private prisma: PrismaService) {}

  async getSettings() {
    const settings = await this.prisma.hostelSettings.findUnique({ where: { id: 1 } });
    if (!settings) {
      return DEFAULT_SETTINGS;
    }
    return settings;
  }

  async updateSettings(data: any) {
    const { hostelName, address, phone, email, gstin } = data;
    const settings = await this.prisma.hostelSettings.upsert({
      where: { id: 1 },
      update: { hostelName, address, phone, email, gstin },
      create: {
        id: 1,
        hostelName: hostelName || DEFAULT_SETTINGS.hostelName,
        address: address || DEFAULT_SETTINGS.address,
        phone: phone || DEFAULT_SETTINGS.phone,
        email: email || DEFAULT_SETTINGS.email,
        gstin: gstin || DEFAULT_SETTINGS.gstin
      }
    });
    return settings;
  }
}
