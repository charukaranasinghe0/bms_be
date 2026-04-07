import { IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';

export class UpdateLoyaltyConfigDto {
  @IsString() @IsOptional() currencyCode?: string;
  @IsString() @IsOptional() currencySymbol?: string;
  @IsNumber() @IsPositive() @IsOptional() pointsPerCurrencyUnit?: number;
  @IsNumber() @Min(1) @IsOptional() redemptionThreshold?: number;
  @IsNumber() @IsPositive() @IsOptional() redemptionValue?: number;
}

export class AdjustPointsDto {
  @IsNumber() points!: number;
  @IsString() @IsOptional() reason?: string;
}
