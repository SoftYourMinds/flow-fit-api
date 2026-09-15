import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRecurringSessionsDto {
  @ApiProperty({ description: 'Client ID to add as participant' })
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

  @ApiProperty({ description: 'Subscription ID to link sessions to', required: false })
  @IsInt()
  @IsOptional()
  subscriptionId?: number;

  @ApiProperty({ description: 'Price per session', required: false })
  @Min(0)
  @IsOptional()
  price?: number;

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
