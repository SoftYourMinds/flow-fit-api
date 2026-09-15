import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSubscriptionWithRecurringDto {
  @ApiProperty({ description: 'Client ID' })
  @IsInt()
  clientId: number;

  @ApiProperty({ description: 'Location ID' })
  @IsInt()
  locationId: number;

  @ApiProperty({
    description: 'Days of week (0=Sunday, 1=Monday, ..., 6=Saturday)',
    type: [Number],
    example: [1, 3, 5],
  })
  @IsArray()
  @IsInt({ each: true })
  @ArrayMinSize(1)
  daysOfWeek: number[];

  @ApiProperty({ description: 'Start time in HH:mm format', example: '10:00' })
  @IsString()
  startTime: string;

  @ApiProperty({ description: 'End time in HH:mm format', example: '11:00' })
  @IsString()
  endTime: string;

  @ApiProperty({ description: 'Date range start (YYYY-MM-DD)' })
  @IsDateString()
  dateFrom: string;

  @ApiProperty({ description: 'Date range end (YYYY-MM-DD)' })
  @IsDateString()
  dateTo: string;

  @ApiProperty({ description: 'Total price of the subscription', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @ApiProperty({ description: 'Whether the subscription is paid', required: false })
  @IsBoolean()
  @IsOptional()
  isPaid?: boolean;

  @ApiProperty({ required: false, type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  workoutTypes?: string[];

  @ApiProperty({
    description: 'Client timezone offset in minutes from UTC (e.g. -180 for UTC+3)',
    required: false,
    example: -180,
  })
  @IsInt()
  @IsOptional()
  timezoneOffset?: number;
}
