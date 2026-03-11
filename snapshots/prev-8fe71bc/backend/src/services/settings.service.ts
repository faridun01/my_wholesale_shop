import prisma from '../db/prisma.js';

export class SettingsService {
  static async getSettings() {
    const settings = await prisma.setting.findMany();
    return settings.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
  }

  static async updateSetting(key: string, value: string) {
    return await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  static async getCategories() {
    return await prisma.category.findMany({
      where: { active: true },
      orderBy: { name: 'asc' }
    });
  }
}
