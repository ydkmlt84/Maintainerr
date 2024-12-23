import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common'
import { AuthService } from '../auth.service'

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    console.log('[ApiKeyGuard] Guard triggered') // Debug log
    const request = context.switchToHttp().getRequest()
    const apiKey = request.headers['x-api-key'] // Extract the `X-Api-Key` header
    if (!apiKey) {
      throw new UnauthorizedException('Invalid or missing X-Api-Key header')
    }

    const user = await this.authService.validateApiKey(apiKey)

    if (!user) {
      throw new UnauthorizedException('Invalid API key')
    }

    request['user'] = user // Attach the user to the request
    return true // Allow the request to proceed
  }
}
