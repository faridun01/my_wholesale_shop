import { describe, it, expect } from 'vitest';
import prisma from '../db/prisma.js';
import { ReminderService } from './reminder.service.js';

type ReminderRecord = {
  id: number;
  userId: number;
  title: string;
  dueDate: Date;
  isCompleted: boolean;
};

const makeReminderRepo = (records: ReminderRecord[]) => {
  const calls: {
    findMany: any[];
    findUnique: any[];
    update: any[];
  } = {
    findMany: [],
    findUnique: [],
    update: [],
  };

  return {
    calls,
    findMany: async (args: any) => {
      calls.findMany.push(args);
      const scopedUserId = args?.where?.userId;
      if (!scopedUserId) {
        return records;
      }
      return records.filter((record) => record.userId === scopedUserId);
    },
    findUnique: async (args: any) => {
      calls.findUnique.push(args);
      return records.find((record) => record.id === args?.where?.id) ?? null;
    },
    update: async (args: any) => {
      calls.update.push(args);
      const record = records.find((item) => item.id === args?.where?.id);
      if (!record) {
        throw new Error('Reminder not found');
      }
      if (typeof args?.data?.isCompleted === 'boolean') {
        record.isCompleted = args.data.isCompleted;
      }
      if (args?.data?.title) {
        record.title = String(args.data.title);
      }
      if (args?.data?.dueDate instanceof Date) {
        record.dueDate = args.data.dueDate;
      }
      return record;
    },
  };
};

const withMockedReminderRepo = async (
  records: ReminderRecord[],
  run: (repo: ReturnType<typeof makeReminderRepo>) => Promise<void>
) => {
  const repo = makeReminderRepo(records);
  const reminderRepo = prisma.reminder as any;
  const original = {
    findMany: reminderRepo.findMany,
    findUnique: reminderRepo.findUnique,
    update: reminderRepo.update,
  };

  reminderRepo.findMany = repo.findMany;
  reminderRepo.findUnique = repo.findUnique;
  reminderRepo.update = repo.update;

  try {
    await run(repo);
  } finally {
    reminderRepo.findMany = original.findMany;
    reminderRepo.findUnique = original.findUnique;
    reminderRepo.update = original.update;
  }
};

describe('ReminderService', () => {
  it('getReminders limits non-admin access to own reminders', async () => {
    await withMockedReminderRepo(
      [
        { id: 1, userId: 10, title: 'mine', dueDate: new Date(), isCompleted: false },
        { id: 2, userId: 20, title: 'other', dueDate: new Date(), isCompleted: false },
      ],
      async (repo) => {
        const result = await ReminderService.getReminders({ userId: 10, isAdmin: false });
        expect(result.length).toBe(1);
        expect(result[0].id).toBe(1);
        expect(repo.calls.findMany[0].where).toEqual({ userId: 10 });
      }
    );
  });

  it('updateReminderForActor denies access to foreign reminder for non-admin', async () => {
    await withMockedReminderRepo(
      [{ id: 2, userId: 20, title: 'other', dueDate: new Date(), isCompleted: false }],
      async (repo) => {
        await expect(
          ReminderService.updateReminderForActor(
            2,
            { userId: 10, isAdmin: false },
            { title: 'hacked' }
          )
        ).rejects.toMatchObject({ status: 404 });
        expect(repo.calls.update.length).toBe(0);
      }
    );
  });

  it('updateReminderForActor allows owner and updates reminder', async () => {
    await withMockedReminderRepo(
      [{ id: 1, userId: 10, title: 'mine', dueDate: new Date(), isCompleted: false }],
      async (repo) => {
        const result = await ReminderService.updateReminderForActor(
          1,
          { userId: 10, isAdmin: false },
          { title: 'updated title' }
        );
        expect(result.title).toBe('updated title');
        expect(repo.calls.update.length).toBe(1);
      }
    );
  });

  it('completeReminderForActor allows admin to complete any reminder', async () => {
    await withMockedReminderRepo(
      [{ id: 5, userId: 99, title: 'other', dueDate: new Date(), isCompleted: false }],
      async () => {
        const result = await ReminderService.completeReminderForActor(5, {
          userId: 1,
          isAdmin: true,
        });
        expect(result.isCompleted).toBe(true);
      }
    );
  });
});
