import { IsEnum, IsInt, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SubscriptionStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class SubscriptionQueryDto {
  @ApiProperty({ description: 'Filter by client ID', required: false })
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  clientId?: number;

  @ApiProperty({ enum: SubscriptionStatus, required: false })
  @IsEnum(SubscriptionStatus)
  @IsOptional()
  status?: SubscriptionStatus;
}
