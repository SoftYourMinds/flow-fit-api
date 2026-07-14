import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { LocationsModule } from './locations/locations.module';
import { SessionsModule } from './sessions/sessions.module';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [PrismaModule, UsersModule, AuthModule, ClientsModule, LocationsModule, SessionsModule, ReportsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
