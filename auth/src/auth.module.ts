import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { Settings } from '../../server/src/modules/settings/entities/settings.entities'
import { JwtStrategy } from './jwt.strategy'
import { ApiKeyGuard } from './guards/api-key.guard'
import { User } from './entities/user.entity'
import * as crypto from 'crypto'
import ormConfig from './config/typeOrmConfig'
import { Type } from 'class-transformer'

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: async () => {
        const randomSecret = crypto.randomBytes(32).toString('hex')
        return {
          secret: randomSecret,
          signOptions: { expiresIn: '1h' },
        }
      },
    }),
    TypeOrmModule.forRoot(ormConfig),
    TypeOrmModule.forFeature([User, Settings]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, ApiKeyGuard],
  exports: [AuthService, ApiKeyGuard],
})
export class AuthModule {}