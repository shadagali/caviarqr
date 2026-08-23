import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'

import { JwtService } from '@nestjs/jwt'

@Injectable()
export class MaintenanceJwtGuard
  implements CanActivate
{
  constructor(
    private jwtService: JwtService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request =
      context
        .switchToHttp()
        .getRequest()

    const authHeader =
      request.headers.authorization ||
      ''

    const token =
      authHeader.startsWith('Bearer ')
        ? authHeader.replace(
            'Bearer ',
            '',
          )
        : ''

    if (!token) {
      throw new UnauthorizedException(
        'Maintenance login required',
      )
    }

    try {
      const payload =
        await this.jwtService.verifyAsync(
          token,
          {
            secret:
              process.env.JWT_SECRET ||
              'supersecretkey',
          },
        )

      if (
        payload.role !==
        'maintenance_admin'
      ) {
        throw new UnauthorizedException(
          'Maintenance admin only',
        )
      }

      request.maintenanceAdmin =
        payload

      return true
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired maintenance login',
      )
    }
  }
}