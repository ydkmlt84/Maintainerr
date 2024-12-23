import {
  Controller,
  Post,
  Get,
  UseGuards,
  Body,
  HttpException,
  Request,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dtos/login.dto';
import { RegisterDto } from './dtos/register.dto';
import { ApiKeyGuard } from './guards/api-key.guard';
// import { JwtAuthGuard } from './guards/jwt-auth.guard'

@Controller('/api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/login')
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(
      loginDto.username,
      loginDto.password,
    );
    if (!user) {
      throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
    }
    return this.authService.login(user);
  }

  @Post('/register')
  async register(@Body() registerDto: RegisterDto) {
    const existingUser = await this.authService.validateUser(
      registerDto.username,
      registerDto.password,
    );
    if (existingUser) {
      throw new HttpException('User already exists', HttpStatus.BAD_REQUEST);
    }
    return this.authService.register(
      registerDto.username,
      registerDto.password,
      registerDto.apikey,
    );
  }
  @UseGuards(ApiKeyGuard)
  @Get('/data')
  getProtectedData(@Request() req: any) {
    // Access the validated user attached by the guard
    return {
      message: 'This is protected data',
      user: req.user,
    };
  }
}
