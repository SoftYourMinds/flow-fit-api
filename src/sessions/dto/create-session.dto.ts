import { ApiProperty } from '@nestjs/swagger';

import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { SessionType, SessionStatus } from '@prisma/client';

import { AddParticipantDto } from './add-participant.dto';

export class CreateSessionDto {
  @ApiProperty()
  @IsInt()
  locationId: number;

  @ApiProperty({ enum: SessionType })
  @IsEnum(SessionType)
  @IsOptional()
  type?: SessionType;

  @ApiProperty()
  @IsDateString()
  startTime: string;

  @ApiProperty()
  @IsDateString()
  endTime: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @ApiProperty({ enum: SessionStatus, required: false })
  @IsEnum(SessionStatus)
  @IsOptional()
  status?: SessionStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  isPaid?: boolean;

  @ApiProperty({ required: false, type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  workoutTypes?: string[];

  @ApiProperty({ required: false, description: 'Number of anonymous/unnamed participants' })
  @IsInt()
  @Min(0)
  @IsOptional()
  anonymousParticipantsCount?: number;

  @ApiProperty({
    required: false,
    type: [AddParticipantDto],
    description: 'Named or registered client participants for this session',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddParticipantDto)
  @IsOptional()
  participants?: AddParticipantDto[];

  @ApiProperty({ required: false, description: 'Whether notification reminder is enabled' })
  @IsBoolean()
  @IsOptional()
  enableNotification?: boolean;

  @ApiProperty({ required: false, description: 'Reminder timing preset, e.g. auto, 15, 30, 60' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'number' || typeof value === 'string' ? String(value) : value,
  )
  @IsString()
  @IsOptional()
  reminderMode?: string;

  @ApiProperty({
    required: false,
    description: 'Critical notification flag (sends Web Push + Telegram)',
  })
  @IsBoolean()
  @IsOptional()
  isCritical?: boolean;
}
