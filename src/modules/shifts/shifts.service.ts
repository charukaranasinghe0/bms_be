import {
  Injectable, NotFoundException, BadRequestException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateShiftDto, UpdateShiftDto, AssignStaffDto,
  CreateTaskDto, UpdateTaskStatusDto,
} from './dto/shift.dto';

@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Shifts ────────────────────────────────────────────────────────────────

  async createShift(dto: CreateShiftDto, createdBy: string) {
    return this.prisma.shift.create({
      data: {
        date: new Date(dto.date),
        startTime: dto.startTime,
        endTime: dto.endTime,
        notes: dto.notes,
        createdBy,
      },
    });
  }

  async listShifts(date?: string) {
    return this.prisma.shift.findMany({
      where: date ? { date: new Date(date) } : undefined,
      include: {
        assignments: { select: { id: true, userId: true, duty: true, clockIn: true, clockOut: true } },
        tasks: { select: { id: true, assignedTo: true, title: true, status: true } },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
  }

  async getShift(id: string) {
    const shift = await this.prisma.shift.findUnique({
      where: { id },
      include: { assignments: true, tasks: true },
    });
    if (!shift) throw new NotFoundException('Shift not found');
    return shift;
  }

  async updateShift(id: string, dto: UpdateShiftDto) {
    await this.getShift(id);
    return this.prisma.shift.update({
      where: { id },
      data: {
        ...(dto.date ? { date: new Date(dto.date) } : {}),
        ...(dto.startTime ? { startTime: dto.startTime } : {}),
        ...(dto.endTime ? { endTime: dto.endTime } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
  }

  async deleteShift(id: string) {
    await this.getShift(id);
    await this.prisma.shift.delete({ where: { id } });
  }

  // ── Assignments ───────────────────────────────────────────────────────────

  async assignStaff(shiftId: string, dto: AssignStaffDto) {
    await this.getShift(shiftId);

    // Verify user exists
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('User not found');

    // Check for conflicting shift on same date/time
    const shift = await this.prisma.shift.findUnique({ where: { id: shiftId } });
    const conflict = await this.prisma.shiftAssignment.findFirst({
      where: {
        userId: dto.userId,
        shift: {
          date: shift!.date,
          id: { not: shiftId },
        },
      },
    });
    if (conflict) throw new ConflictException('Staff already assigned to another shift on this date');

    try {
      return await this.prisma.shiftAssignment.create({
        data: { shiftId, userId: dto.userId, duty: dto.duty },
      });
    } catch (e: any) {
      if (e.code === 'P2002') throw new ConflictException('Staff already assigned to this shift');
      throw e;
    }
  }

  async removeAssignment(assignmentId: string) {
    const assignment = await this.prisma.shiftAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('Assignment not found');
    await this.prisma.shiftAssignment.delete({ where: { id: assignmentId } });
  }

  async clockIn(assignmentId: string) {
    const assignment = await this.prisma.shiftAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('Assignment not found');
    if (assignment.clockIn) throw new BadRequestException('Already clocked in');
    return this.prisma.shiftAssignment.update({
      where: { id: assignmentId },
      data: { clockIn: new Date() },
    });
  }

  async clockOut(assignmentId: string) {
    const assignment = await this.prisma.shiftAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('Assignment not found');
    if (!assignment.clockIn) throw new BadRequestException('Must clock in before clocking out');
    if (assignment.clockOut) throw new BadRequestException('Already clocked out');
    return this.prisma.shiftAssignment.update({
      where: { id: assignmentId },
      data: { clockOut: new Date() },
    });
  }

  /** Get all shifts for a specific user (their schedule) */
  async getMyShifts(userId: string) {
    return this.prisma.shift.findMany({
      where: { assignments: { some: { userId } } },
      include: {
        assignments: { where: { userId }, select: { id: true, duty: true, clockIn: true, clockOut: true } },
        tasks: { where: { assignedTo: userId }, select: { id: true, title: true, status: true } },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────

  async createTask(shiftId: string, dto: CreateTaskDto) {
    await this.getShift(shiftId);
    const user = await this.prisma.user.findUnique({ where: { id: dto.assignedTo } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.shiftTask.create({
      data: { shiftId, assignedTo: dto.assignedTo, title: dto.title, description: dto.description },
    });
  }

  async updateTaskStatus(taskId: string, dto: UpdateTaskStatusDto, requestingUserId: string, requestingRole: string) {
    const task = await this.prisma.shiftTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');

    // Staff can only update their own tasks; ADMIN/MANAGER can update any
    if (!['ADMIN', 'MANAGER'].includes(requestingRole) && task.assignedTo !== requestingUserId) {
      throw new BadRequestException('You can only update your own tasks');
    }

    const now = new Date();
    return this.prisma.shiftTask.update({
      where: { id: taskId },
      data: {
        status: dto.status,
        startedAt: dto.status === 'IN_PROGRESS' && !task.startedAt ? now : task.startedAt,
        completedAt: dto.status === 'DONE' ? now : task.completedAt,
      },
    });
  }

  async deleteTask(taskId: string) {
    const task = await this.prisma.shiftTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    await this.prisma.shiftTask.delete({ where: { id: taskId } });
  }

  // ── Reports ───────────────────────────────────────────────────────────────

  async getAttendanceReport(from: Date, to: Date) {
    const assignments = await this.prisma.shiftAssignment.findMany({
      where: { shift: { date: { gte: from, lte: to } } },
      include: { shift: { select: { date: true, startTime: true, endTime: true } } },
      orderBy: { shift: { date: 'asc' } },
    });

    const byUser: Record<string, {
      userId: string; totalShifts: number; totalMinutes: number; records: any[];
    }> = {};

    for (const a of assignments) {
      if (!byUser[a.userId]) byUser[a.userId] = { userId: a.userId, totalShifts: 0, totalMinutes: 0, records: [] };
      const entry = byUser[a.userId];
      entry.totalShifts++;

      let minutes = 0;
      if (a.clockIn && a.clockOut) {
        minutes = Math.round((a.clockOut.getTime() - a.clockIn.getTime()) / 60000);
        entry.totalMinutes += minutes;
      }

      entry.records.push({
        shiftDate: a.shift.date,
        duty: a.duty,
        clockIn: a.clockIn,
        clockOut: a.clockOut,
        minutesWorked: minutes,
      });
    }

    return { from, to, byUser: Object.values(byUser) };
  }
}
