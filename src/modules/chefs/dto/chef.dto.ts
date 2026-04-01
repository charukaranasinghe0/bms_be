import { IsString, IsNotEmpty, IsOptional, IsIn, MinLength } from 'class-validator';

export class CreateChefDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name!: string;

  @IsString()
  @IsIn(['AVAILABLE', 'BUSY'])
  @IsOptional()
  status?: 'AVAILABLE' | 'BUSY';
}

export class UpdateChefDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @IsOptional()
  name?: string;

  @IsString()
  @IsIn(['AVAILABLE', 'BUSY'])
  @IsOptional()
  status?: 'AVAILABLE' | 'BUSY';
}

export class SetChefStatusDto {
  @IsString()
  @IsIn(['AVAILABLE', 'BUSY'])
  status!: 'AVAILABLE' | 'BUSY';
}
