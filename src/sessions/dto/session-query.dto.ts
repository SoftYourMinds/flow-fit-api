import { IsDateString, IsEnum, IsInt, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SessionType, SessionStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class SessionQueryDto {
  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  start?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  end?: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  locationId?: number;

  @ApiPropertyOptional({ enum: SessionType })
  @IsEnum(SessionType)
  @IsOptional()
  type?: SessionType;

  @ApiPropertyOptional({ enum: SessionStatus })
  @IsEnum(SessionStatus)
  @IsOptional()
  status?: SessionStatus;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  clientId?: number;
}
