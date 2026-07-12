import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { LocationsModule } from './locations/locations.module';

@Module({
  imports: [PrismaModule, UsersModule, AuthModule, ClientsModule, LocationsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
