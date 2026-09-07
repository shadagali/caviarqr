import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm'

export class AddHardwareShop20260902160000
  implements MigrationInterface
{
  name =
    'AddHardwareShop20260902160000'

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "shop_product" (
        "id" SERIAL NOT NULL,
        "name" varchar(140) NOT NULL,
        "description" text NOT NULL DEFAULT '',
        "priceCents" integer NOT NULL,
        "imageUrl" varchar(500),
        "inventory" integer NOT NULL DEFAULT 0,
        "active" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_shop_product"
          PRIMARY KEY ("id"),
        CONSTRAINT "CHK_shop_product_price"
          CHECK ("priceCents" >= 50),
        CONSTRAINT "CHK_shop_product_inventory"
          CHECK ("inventory" >= 0)
      )
    `)

    await queryRunner.query(`
      CREATE TABLE "shop_order" (
        "id" SERIAL NOT NULL,
        "orderNumber" varchar(40) NOT NULL,
        "email" varchar(254),
        "customerName" varchar(180),
        "phone" varchar(50),
        "shippingAddress" jsonb,
        "subtotalCents" integer NOT NULL,
        "shippingCents" integer NOT NULL DEFAULT 0,
        "totalCents" integer NOT NULL,
        "currency" varchar(8) NOT NULL DEFAULT 'usd',
        "stripeCheckoutSessionId" varchar(255),
        "stripePaymentIntentId" varchar(255),
        "paymentStatus" varchar(32) NOT NULL DEFAULT 'PENDING',
        "fulfillmentStatus" varchar(32) NOT NULL DEFAULT 'UNFULFILLED',
        "trackingNumber" varchar(120),
        "inventoryReserved" boolean NOT NULL DEFAULT false,
        "checkoutExpiresAt" TIMESTAMPTZ,
        "paidAt" TIMESTAMPTZ,
        "shippedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_shop_order"
          PRIMARY KEY ("id"),
        CONSTRAINT "UQ_shop_order_number"
          UNIQUE ("orderNumber"),
        CONSTRAINT "UQ_shop_order_checkout"
          UNIQUE ("stripeCheckoutSessionId"),
        CONSTRAINT "UQ_shop_order_payment_intent"
          UNIQUE ("stripePaymentIntentId"),
        CONSTRAINT "CHK_shop_order_subtotal"
          CHECK ("subtotalCents" >= 0),
        CONSTRAINT "CHK_shop_order_shipping"
          CHECK ("shippingCents" >= 0),
        CONSTRAINT "CHK_shop_order_total"
          CHECK ("totalCents" >= 0)
      )
    `)

    await queryRunner.query(`
      CREATE TABLE "shop_order_item" (
        "id" SERIAL NOT NULL,
        "orderId" integer NOT NULL,
        "productId" integer,
        "productName" varchar(140) NOT NULL,
        "unitPriceCents" integer NOT NULL,
        "quantity" integer NOT NULL,
        CONSTRAINT "PK_shop_order_item"
          PRIMARY KEY ("id"),
        CONSTRAINT "CHK_shop_order_item_price"
          CHECK ("unitPriceCents" >= 0),
        CONSTRAINT "CHK_shop_order_item_quantity"
          CHECK ("quantity" >= 1),
        CONSTRAINT "FK_shop_order_item_order"
          FOREIGN KEY ("orderId")
          REFERENCES "shop_order"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_shop_order_item_product"
          FOREIGN KEY ("productId")
          REFERENCES "shop_product"("id")
          ON DELETE SET NULL
      )
    `)

    await queryRunner.query(`
      CREATE INDEX
        "IDX_shop_order_created"
      ON "shop_order" ("createdAt")
    `)

    await queryRunner.query(`
      CREATE INDEX
        "IDX_shop_order_payment_status"
      ON "shop_order" ("paymentStatus")
    `)

    await queryRunner.query(`
      CREATE INDEX
        "IDX_shop_order_fulfillment"
      ON "shop_order" ("fulfillmentStatus")
    `)

    await queryRunner.query(`
      CREATE INDEX
        "IDX_shop_order_item_order"
      ON "shop_order_item" ("orderId")
    `)
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "shop_order_item"
    `)

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "shop_order"
    `)

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "shop_product"
    `)
  }
}
