import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './order.entity';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { OrderGateway } from './order.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([Order])],
  providers: [OrderService, OrderGateway],
  controllers: [OrderController],
  exports: [OrderService],
})
export class OrderModule {}