import {
  IsString, IsNotEmpty, IsOptional, IsEnum, IsUUID, IsDateString,
} from 'class-validator';

export enum ShiftStatus {
  SCHEDULED = 'SCHEDULED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  SKIPPED = 'SKIPPED',
}

// ── Shift DTOs ────────────────────────────────────────────────────────────────

export class CreateShiftDto {
  @IsDateString() date!: string; // ISO date string e.g. "2026-04-07"
  @IsString() @IsNotEmpty() startTime!: string; // e.g. "08:00"
  @IsString() @IsNotEmpty() endTime!: string;   // e.g. "16:00"
  @IsString() @IsOptional() notes?: string;
}

export class UpdateShiftDto {
  @IsDateString() @IsOptional() date?: string;
  @IsString() @IsOptional() startTime?: string;
  @IsString() @IsOptional() endTime?: string;
  @IsEnum(ShiftStatus) @IsOptional() status?: ShiftStatus;
  @IsString() @IsOptional() notes?: string;
}

// ── Assignment DTOs ───────────────────────────────────────────────────────────

export class AssignStaffDto {
  @IsUUID() userId!: string;
  @IsString() @IsNotEmpty() duty!: string; // e.g. "CASHIER", "BAKER"
}

export class ClockInDto {
  @IsUUID() assignmentId!: string;
}

export class ClockOutDto {
  @IsUUID() assignmentId!: string;
}

// ── Task DTOs ─────────────────────────────────────────────────────────────────

export class CreateTaskDto {
  @IsUUID() assignedTo!: string; // userId
  @IsString() @IsNotEmpty() title!: string;
  @IsString() @IsOptional() description?: string;
}

export class UpdateTaskStatusDto {
  @IsEnum(TaskStatus) status!: TaskStatus;
}
