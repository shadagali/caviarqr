import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Consumer } from './consumer.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Consumer])],
  exports: [TypeOrmModule],
})
export class ConsumerModule {}