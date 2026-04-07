import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsBoolean } from 'class-validator';

export class CreateCategoryDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsOptional() description?: string;
  @IsInt() @Min(0) @IsOptional() sortOrder?: number;
}

export class UpdateCategoryDto {
  @IsString() @IsNotEmpty() @IsOptional() name?: string;
  @IsString() @IsOptional() description?: string;
  @IsInt() @Min(0) @IsOptional() sortOrder?: number;
  @IsBoolean() @IsOptional() isActive?: boolean;
}
