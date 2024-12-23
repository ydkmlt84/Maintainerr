import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Settings } from '../settings/entities/settings.entities';
//import { WinstonModule } from 'nest-winston';
//import winston from 'winston';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Settings)
    private readonly settingsRepo: Repository<Settings>,
  ) {}

  /**
   * Retrieve an API key from the Settings repository.
   */
  private async getAppApiKey(apikey: string): Promise<Settings> {
    const setting = await this.settingsRepo.findOne({
      where: { apikey },
    });
    if (!setting) {
      throw new Error('Invalid API key');
    }
    return setting;
  }

  /**
   * Register a new user and associate the retrieved API key with the user.
   */
  async register(username: string, password: string, apikey: string) {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Retrieve the API key from the Settings repository
    const appApiKey = await this.getAppApiKey(apikey);

    if (!appApiKey) {
      throw new Error('Invalid API key');
    }

    // Create the new user
    const newUser = this.userRepository.create({
      username,
      password: hashedPassword,
      apikey: appApiKey.apikey, // Associate the API key
    });
    // Save the user in the User repository
    return this.userRepository.save(newUser);
  }

  /**
   * Validate a user by username and password.
   */
  async validateUser(username: string, password: string): Promise<any> {
    // Validate using username and password
    const user = await this.userRepository.findOne({
      where: { username: username },
    });
    if (!user) {
      console.warn(`Password validation failed for username: ${username}`);
      throw new UnauthorizedException('Invalid username');
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.warn(`Password validation failed for username: ${username}`);
      throw new UnauthorizedException('Invalid password');
    }
    if (user && (await bcrypt.compare(password, user.password))) {
      console.log(`Password validation succeeded for user: ${user.username}`);
      const { ...result } = user; // Exclude sensitive fields
      return result;
    }
  }
  // Validate ApiKey
  async validateApiKey(apiKey: string): Promise<any> {
    // Find the user by API key
    const user = await this.userRepository.findOne({
      where: { apikey: apiKey },
    });

    if (!user) {
      return null; // Return null if the API key is invalid
    }
    if (user) {
      console.log('Apikey authentication successful');
      const { ...result } = user; // Exclude sensitive fields
      return result;
    }
  }

  /**
   * Log in the user and return a JWT token.
   */
  async login(user: any) {
    const payload = { username: user.username, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
