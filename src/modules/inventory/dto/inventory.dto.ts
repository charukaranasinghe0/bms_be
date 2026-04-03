import {
  IsString, IsNotEmpty, IsNumber, IsBoolean, IsOptional,
  IsEnum, IsUUID, Min, IsDateString,
} from 'class-validator';

export enum InventoryAdjustmentType {
  USE = 'USE',
  SALE = 'SALE',
  DAMAGE = 'DAMAGE',
  LOSS = 'LOSS',
}

export class CreateInventoryItemDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsNotEmpty() category!: string;
  @IsString() @IsNotEmpty() unit!: string;
  @IsBoolean() @IsOptional() isPerishable?: boolean;
  @IsNumber() @Min(0) @IsOptional() minReorderLevel?: number;
}

export class CreateBatchDto {
  @IsUUID() itemId!: string;
  @IsString() @IsOptional() lotNumber?: string;
  @IsNumber() @Min(0) quantity!: number;
  @IsNumber() @IsOptional() unitCost?: number;
  @IsDateString() @IsOptional() expirationDate?: string | null;
}

export class AdjustStockDto {
  @IsUUID() batchId!: string;
  @IsNumber() @Min(0.001) quantity!: number;
  @IsEnum(InventoryAdjustmentType) type!: InventoryAdjustmentType;
  @IsString() @IsOptional() reason?: string;
  @IsNumber() @IsOptional() cost?: number;
}

export class CreateEquipmentDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsOptional() serialNumber?: string;
  @IsDateString() @IsOptional() purchaseDate?: string | null;
  @IsDateString() @IsOptional() warrantyExpiryDate?: string | null;
  @IsNumber() @IsOptional() maintenanceIntervalDays?: number | null;
}

export class CreateMaintenanceDto {
  @IsUUID() equipmentId!: string;
  @IsDateString() @IsOptional() performedAt?: string | null;
  @IsString() @IsOptional() description?: string;
  @IsNumber() @IsOptional() cost?: number;
  @IsDateString() @IsOptional() nextDueDate?: string | null;
}

export class CreateRecipeItemDto {
  @IsUUID() productId!: string;
  @IsUUID() inventoryItemId!: string;
  @IsNumber() @Min(0.001) quantityPerUnit!: number;
}
