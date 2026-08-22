import { IsArray, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SessionType, SessionStatus } from '@prisma/client';

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

  @ApiProperty({ required: false, description: 'Max number of participants allowed' })
  @IsInt()
  @Min(1)
  @IsOptional()
  maxParticipants?: number;
}
