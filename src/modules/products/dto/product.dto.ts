import { IsString, IsNotEmpty, IsNumber, IsPositive, IsBoolean, IsOptional, MinLength } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name!: string;

  @IsNumber()
  @IsPositive()
  price!: number;

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;
}

export class UpdateProductDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  price?: number;

  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;
}
