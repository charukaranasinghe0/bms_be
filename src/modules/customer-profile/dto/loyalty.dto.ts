import { IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';

export class UpdateLoyaltyConfigDto {
  @IsString() @IsOptional() currencyCode?: string;
  @IsString() @IsOptional() currencySymbol?: string;
  @IsNumber() @IsPositive() @IsOptional() pointsPerAmount?: number;
  @IsNumber() @IsPositive() @IsOptional() amountPerPoints?: number;
  @IsNumber() @Min(1) @IsOptional() redeemThreshold?: number;
  @IsNumber() @IsPositive() @IsOptional() redeemDiscount?: number;
  @IsNumber() @Min(0) @IsOptional() regularThreshold?: number;
  @IsNumber() @Min(0) @IsOptional() loyalThreshold?: number;
  @IsNumber() @Min(0) @IsOptional() vipThreshold?: number;
}

export class AdjustPointsDto {
  @IsNumber() points!: number;
  @IsString() @IsOptional() reason?: string;
}
