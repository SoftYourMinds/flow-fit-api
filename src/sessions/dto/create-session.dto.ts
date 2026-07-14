import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, Min } from 'class-validator';
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
}
