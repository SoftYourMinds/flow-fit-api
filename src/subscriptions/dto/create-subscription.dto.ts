import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SubscriptionType } from '@prisma/client';

export class CreateSubscriptionDto {
  @ApiProperty({ description: 'Client ID' })
  @IsInt()
  clientId: number;

  @ApiProperty({ enum: SubscriptionType, default: SubscriptionType.SESSIONS_BASED })
  @IsEnum(SubscriptionType)
  @IsOptional()
  type?: SubscriptionType;

  @ApiProperty({
    description: 'Total sessions in subscription (required for SESSIONS_BASED)',
    required: false,
  })
  @ValidateIf((o: CreateSubscriptionDto) => o.type === SubscriptionType.SESSIONS_BASED || !o.type)
  @IsInt()
  @Min(1)
  totalSessions?: number;

  @ApiProperty({
    description: 'Subscription start date (required for DATE_RANGE)',
    required: false,
  })
  @ValidateIf((o: CreateSubscriptionDto) => o.type === SubscriptionType.DATE_RANGE)
  @IsDateString()
  startDate?: string;

  @ApiProperty({ description: 'Subscription end date (required for DATE_RANGE)', required: false })
  @ValidateIf((o: CreateSubscriptionDto) => o.type === SubscriptionType.DATE_RANGE)
  @IsDateString()
  endDate?: string;

  @ApiProperty({ description: 'Price for the subscription', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @ApiProperty({ description: 'Whether the subscription is paid', required: false })
  @IsOptional()
  isPaid?: boolean;
}
