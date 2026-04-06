import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { JwtUserPayload } from '../../auth/jwt-payload.interface';
import { ShiftsService } from './shifts.service';
import {
  CreateShiftDto, UpdateShiftDto, AssignStaffDto,
  CreateTaskDto, UpdateTaskStatusDto,
} from './dto/shift.dto';

function ok<T>(data: T, message?: string) {
  return { success: true, data, ...(message ? { message } : {}) };
}

@Controller('shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  // ── Shifts ────────────────────────────────────────────────────────────────

  @Post()
  @Roles('ADMIN', 'MANAGER')
  async createShift(@Body() dto: CreateShiftDto, @CurrentUser() user: JwtUserPayload) {
    return ok(await this.shiftsService.createShift(dto, user.userId), 'Shift created');
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'CASHIER')
  async listShifts(@Query('date') date?: string) {
    return ok(await this.shiftsService.listShifts(date));
  }

  @Get('my')
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'CASHIER')
  async getMyShifts(@CurrentUser() user: JwtUserPayload) {
    return ok(await this.shiftsService.getMyShifts(user.userId));
  }

  @Get('reports/attendance')
  @Roles('ADMIN', 'MANAGER')
  async getAttendanceReport(@Query('from') from?: string, @Query('to') to?: string) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();
    return ok(await this.shiftsService.getAttendanceReport(fromDate, toDate));
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'CASHIER')
  async getShift(@Param('id') id: string) {
    return ok(await this.shiftsService.getShift(id));
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  async updateShift(@Param('id') id: string, @Body() dto: UpdateShiftDto) {
    return ok(await this.shiftsService.updateShift(id, dto), 'Shift updated');
  }

  @Delete(':id')
  @Roles('ADMIN')
  async deleteShift(@Param('id') id: string) {
    await this.shiftsService.deleteShift(id);
    return ok(null, 'Shift deleted');
  }

  // ── Assignments ───────────────────────────────────────────────────────────

  @Post(':id/assign')
  @Roles('ADMIN', 'MANAGER')
  async assignStaff(@Param('id') shiftId: string, @Body() dto: AssignStaffDto) {
    return ok(await this.shiftsService.assignStaff(shiftId, dto), 'Staff assigned');
  }

  @Delete('assignments/:assignmentId')
  @Roles('ADMIN', 'MANAGER')
  async removeAssignment(@Param('assignmentId') assignmentId: string) {
    await this.shiftsService.removeAssignment(assignmentId);
    return ok(null, 'Assignment removed');
  }

  @Patch('assignments/:assignmentId/clock-in')
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'CASHIER')
  async clockIn(@Param('assignmentId') assignmentId: string) {
    return ok(await this.shiftsService.clockIn(assignmentId), 'Clocked in');
  }

  @Patch('assignments/:assignmentId/clock-out')
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'CASHIER')
  async clockOut(@Param('assignmentId') assignmentId: string) {
    return ok(await this.shiftsService.clockOut(assignmentId), 'Clocked out');
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────

  @Post(':id/tasks')
  @Roles('ADMIN', 'MANAGER')
  async createTask(@Param('id') shiftId: string, @Body() dto: CreateTaskDto) {
    return ok(await this.shiftsService.createTask(shiftId, dto), 'Task created');
  }

  @Patch('tasks/:taskId/status')
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'CASHIER')
  async updateTaskStatus(
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskStatusDto,
    @CurrentUser() user: JwtUserPayload,
  ) {
    return ok(
      await this.shiftsService.updateTaskStatus(taskId, dto, user.userId, user.role ?? ''),
      'Task status updated',
    );
  }

  @Delete('tasks/:taskId')
  @Roles('ADMIN', 'MANAGER')
  async deleteTask(@Param('taskId') taskId: string) {
    await this.shiftsService.deleteTask(taskId);
    return ok(null, 'Task deleted');
  }
}
