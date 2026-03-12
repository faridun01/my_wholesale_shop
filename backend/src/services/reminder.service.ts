import prisma from '../db/prisma.js';

export class ReminderService {
  static async getReminders() {
    return await prisma.reminder.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  static async createReminder(data: {
    userId: number;
    title: string;
    description?: string;
    dueDate: string;
    type?: string;
    referenceId?: number;
  }) {
    return await prisma.reminder.create({
      data: {
        ...data,
        dueDate: new Date(data.dueDate),
      },
    });
  }

  static async completeReminder(id: number) {
    return await prisma.reminder.update({
      where: { id },
      data: { isCompleted: true },
    });
  }

  static async deleteReminder(id: number) {
    return await prisma.reminder.delete({
      where: { id },
    });
  }
}
