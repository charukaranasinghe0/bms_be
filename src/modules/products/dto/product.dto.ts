import {
  IsString, IsNotEmpty, IsNumber, IsPositive, IsBoolean,
  IsOptional, MinLength, IsInt, Min, IsEnum,
} from 'class-validator';

export enum CookCategory {
  PASTRY = 'PASTRY',
  BREAD = 'BREAD',
  HOT_FOOD = 'HOT_FOOD',
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsNumber()
  @IsPositive()
  price!: number;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  stockQty?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  lowStockThreshold?: number;

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;

  @IsBoolean()
  @IsOptional()
  requiresCooking?: boolean;

  @IsEnum(CookCategory)
  @IsOptional()
  cookCategory?: CookCategory | null;

  @IsString()
  @IsOptional()
  categoryId?: string | null;
}

export class UpdateProductDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  stockQty?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  lowStockThreshold?: number;

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;

  @IsBoolean()
  @IsOptional()
  requiresCooking?: boolean;

  @IsEnum(CookCategory)
  @IsOptional()
  cookCategory?: CookCategory | null;

  @IsString()
  @IsOptional()
  categoryId?: string | null;
}
