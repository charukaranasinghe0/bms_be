import { IsString, IsNotEmpty, IsOptional, IsEmail, Matches } from 'class-validator';

export class UpdateCustomerDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{7,15}$/, { message: 'phone must be 7-15 digits' })
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;
}
