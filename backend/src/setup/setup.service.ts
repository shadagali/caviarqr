import { Injectable } from '@nestjs/common'

@Injectable()
export class SetupService {
  async init() {
    return { message: 'Setup not needed' }
  }
}