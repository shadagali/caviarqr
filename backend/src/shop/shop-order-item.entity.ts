import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'

import {
  ShopOrder,
} from './shop-order.entity'

import {
  ShopProduct,
} from './shop-product.entity'

@Entity({
  name: 'shop_order_item',
})
export class ShopOrderItem {
  @PrimaryGeneratedColumn()
  id: number

  @Column({
    type: 'int',
  })
  orderId: number

  @ManyToOne(
    () => ShopOrder,
    (order) => order.items,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'orderId',
  })
  order: ShopOrder

  @Column({
    type: 'int',
    nullable: true,
  })
  productId: number | null

  @ManyToOne(
    () => ShopProduct,
    {
      nullable: true,
      onDelete: 'SET NULL',
    },
  )
  @JoinColumn({
    name: 'productId',
  })
  product: ShopProduct | null

  @Column({
    type: 'varchar',
    length: 140,
  })
  productName: string

  @Column({
    type: 'int',
  })
  unitPriceCents: number

  @Column({
    type: 'int',
  })
  quantity: number
}
