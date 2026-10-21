import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm'

export class AddSalesPartnerCore20260912110000
  implements MigrationInterface
{
  name =
    'AddSalesPartnerCore20260912110000'

  public async up(
    queryRunner: QueryRunner,
  ): Promise<void> {
    /*
     * Independent Sales Partner master record.
     *
     * commissionBps:
     *   1000 = 10% of CaviarQR platform fees.
     *
     * hardwareDiscountBps:
     *   optional discount attached to the
     *   partner's referral code.
     */
    await queryRunner.query(`
      CREATE TABLE "sales_partner" (
        "id" SERIAL NOT NULL,
        "email" varchar(254) NOT NULL,
        "passwordHash" varchar(255) NOT NULL,
        "legalName" varchar(180) NOT NULL,
        "displayName" varchar(180),
        "phone" varchar(50),
        "countryCode" varchar(2) NOT NULL DEFAULT 'US',
        "referralCode" varchar(32) NOT NULL,
        "commissionBps" integer NOT NULL DEFAULT 1000,
        "hardwareDiscountBps" integer NOT NULL DEFAULT 0,
        "status" varchar(32) NOT NULL DEFAULT 'PENDING',
        "stripeAccountId" varchar(255),
        "stripeDetailsSubmitted" boolean NOT NULL DEFAULT false,
        "stripePayoutsEnabled" boolean NOT NULL DEFAULT false,
        "stripeAccountReady" boolean NOT NULL DEFAULT false,
        "stripeLastCheckedAt" TIMESTAMPTZ,
        "lastLoginAt" TIMESTAMPTZ,
        "failedLoginAttempts" integer NOT NULL DEFAULT 0,
        "lockedUntil" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

        CONSTRAINT "PK_sales_partner"
          PRIMARY KEY ("id"),

        CONSTRAINT "UQ_sales_partner_email"
          UNIQUE ("email"),

        CONSTRAINT "UQ_sales_partner_referral_code"
          UNIQUE ("referralCode"),

        CONSTRAINT "UQ_sales_partner_stripe_account"
          UNIQUE ("stripeAccountId"),

        CONSTRAINT "CHK_sales_partner_email_lower"
          CHECK ("email" = lower("email")),

        CONSTRAINT "CHK_sales_partner_referral_upper"
          CHECK ("referralCode" = upper("referralCode")),

        CONSTRAINT "CHK_sales_partner_commission_bps"
          CHECK (
            "commissionBps" >= 0
            AND "commissionBps" <= 10000
          ),

        CONSTRAINT "CHK_sales_partner_discount_bps"
          CHECK (
            "hardwareDiscountBps" >= 0
            AND "hardwareDiscountBps" <= 10000
          ),

        CONSTRAINT "CHK_sales_partner_failed_logins"
          CHECK ("failedLoginAttempts" >= 0)
      )
    `)

    /*
     * Immutable evidence of contractor
     * agreement acceptance.
     */
    await queryRunner.query(`
      CREATE TABLE "sales_partner_agreement" (
        "id" BIGSERIAL NOT NULL,
        "salesPartnerId" integer NOT NULL,
        "agreementVersion" varchar(64) NOT NULL,
        "agreementHash" varchar(64) NOT NULL,
        "acceptedAt" TIMESTAMPTZ NOT NULL,
        "ipAddress" varchar(64),
        "userAgent" text,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

        CONSTRAINT "PK_sales_partner_agreement"
          PRIMARY KEY ("id"),

        CONSTRAINT "UQ_sales_partner_agreement_version"
          UNIQUE (
            "salesPartnerId",
            "agreementVersion"
          ),

        CONSTRAINT "FK_sales_partner_agreement_partner"
          FOREIGN KEY ("salesPartnerId")
          REFERENCES "sales_partner"("id")
          ON DELETE CASCADE
      )
    `)

    /*
     * One commission entry per restaurant
     * order. This is the accounting source
     * of truth; payouts do not mutate the
     * amount earned.
     */
    await queryRunner.query(`
      CREATE TABLE "sales_commission" (
        "id" BIGSERIAL NOT NULL,
        "salesPartnerId" integer NOT NULL,
        "businessId" integer NOT NULL,
        "orderId" integer NOT NULL,
        "platformFeeCents" integer NOT NULL,
        "commissionBps" integer NOT NULL,
        "commissionUnits" bigint NOT NULL,
        "currency" varchar(8) NOT NULL DEFAULT 'usd',
        "status" varchar(32) NOT NULL DEFAULT 'PENDING',
        "availableAt" TIMESTAMPTZ,
        "reversedAt" TIMESTAMPTZ,
        "reversalReason" text,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

        CONSTRAINT "PK_sales_commission"
          PRIMARY KEY ("id"),

        CONSTRAINT "UQ_sales_commission_order"
          UNIQUE ("orderId"),

        CONSTRAINT "CHK_sales_commission_platform_fee"
          CHECK ("platformFeeCents" >= 0),

        CONSTRAINT "CHK_sales_commission_bps"
          CHECK (
            "commissionBps" >= 0
            AND "commissionBps" <= 10000
          ),

        CONSTRAINT "CHK_sales_commission_amount"
          CHECK ("commissionUnits" >= 0),

        CONSTRAINT "CHK_sales_commission_exact_amount"
          CHECK (
            "commissionUnits" =
              (
                "platformFeeCents"::bigint *
                "commissionBps"::bigint
              )
          ),

        CONSTRAINT "FK_sales_commission_partner"
          FOREIGN KEY ("salesPartnerId")
          REFERENCES "sales_partner"("id")
          ON DELETE RESTRICT,

        CONSTRAINT "FK_sales_commission_business"
          FOREIGN KEY ("businessId")
          REFERENCES "business"("id")
          ON DELETE RESTRICT,

        CONSTRAINT "FK_sales_commission_order"
          FOREIGN KEY ("orderId")
          REFERENCES "order"("id")
          ON DELETE RESTRICT
      )
    `)

    /*
     * Stripe transfer/payout batch.
     * Each persisted payout batch has one
     * stable Stripe idempotency key so retries
     * cannot create duplicate partner payments.
     */
    await queryRunner.query(`
      CREATE TABLE "sales_payout" (
        "id" BIGSERIAL NOT NULL,
        "salesPartnerId" integer NOT NULL,
        "amountCents" integer NOT NULL,
        "currency" varchar(8) NOT NULL DEFAULT 'usd',
        "stripeDestinationAccountId" varchar(255),
        "status" varchar(32) NOT NULL DEFAULT 'PENDING',
        "stripeTransferId" varchar(255),
        "idempotencyKey" varchar(255) NOT NULL,
        "requestedAt" TIMESTAMPTZ,
        "paidAt" TIMESTAMPTZ,
        "failedAt" TIMESTAMPTZ,
        "failureMessage" text,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

        CONSTRAINT "PK_sales_payout"
          PRIMARY KEY ("id"),

        CONSTRAINT "UQ_sales_payout_transfer"
          UNIQUE ("stripeTransferId"),

        CONSTRAINT "UQ_sales_payout_idempotency"
          UNIQUE ("idempotencyKey"),

        CONSTRAINT "CHK_sales_payout_amount"
          CHECK ("amountCents" > 0),

        CONSTRAINT "FK_sales_payout_partner"
          FOREIGN KEY ("salesPartnerId")
          REFERENCES "sales_partner"("id")
          ON DELETE RESTRICT
      )
    `)

    /*
     * Immutable mapping of commissions to
     * a specific payout batch.
     */
    await queryRunner.query(`
      CREATE TABLE "sales_payout_item" (
        "id" BIGSERIAL NOT NULL,
        "salesPayoutId" bigint NOT NULL,
        "salesCommissionId" bigint NOT NULL,
        "amountUnits" bigint NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

        CONSTRAINT "PK_sales_payout_item"
          PRIMARY KEY ("id"),

        CONSTRAINT "UQ_sales_payout_item_payout_commission"
          UNIQUE (
            "salesPayoutId",
            "salesCommissionId"
          ),

        CONSTRAINT "CHK_sales_payout_item_amount"
          CHECK ("amountUnits" > 0),

        CONSTRAINT "FK_sales_payout_item_payout"
          FOREIGN KEY ("salesPayoutId")
          REFERENCES "sales_payout"("id")
          ON DELETE CASCADE,

        CONSTRAINT "FK_sales_payout_item_commission"
          FOREIGN KEY ("salesCommissionId")
          REFERENCES "sales_commission"("id")
          ON DELETE RESTRICT
      )
    `)

    await queryRunner.query(`
      CREATE TABLE "sales_audit_log" (
        "id" BIGSERIAL NOT NULL,
        "salesPartnerId" integer,
        "actorType" varchar(32) NOT NULL,
        "actorIdentifier" varchar(180),
        "action" varchar(120) NOT NULL,
        "metadata" jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

        CONSTRAINT "PK_sales_audit_log"
          PRIMARY KEY ("id"),

        CONSTRAINT "FK_sales_audit_log_partner"
          FOREIGN KEY ("salesPartnerId")
          REFERENCES "sales_partner"("id")
          ON DELETE SET NULL
      )
    `)

    /*
     * Hardware checkout remembers which
     * partner/code originated the sale.
     * We snapshot the code and discount so
     * later edits cannot rewrite history.
     */
    await queryRunner.query(`
      ALTER TABLE "shop_order"
      ADD COLUMN "salesPartnerId" integer,
      ADD COLUMN "salesCode" varchar(32),
      ADD COLUMN "salesDiscountCents"
        integer NOT NULL DEFAULT 0
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      ADD CONSTRAINT "CHK_shop_order_sales_discount"
        CHECK ("salesDiscountCents" >= 0),
      ADD CONSTRAINT "FK_shop_order_sales_partner"
        FOREIGN KEY ("salesPartnerId")
        REFERENCES "sales_partner"("id")
        ON DELETE SET NULL
    `)

    /*
     * Stand allocation carries attribution
     * from the paid hardware order into the
     * eventual restaurant account.
     */
    await queryRunner.query(`
      ALTER TABLE "stand_code"
      ADD COLUMN "shopOrderId" integer,
      ADD COLUMN "salesPartnerId" integer,
      ADD COLUMN "salesAttributionSource"
        varchar(32)
    `)

    await queryRunner.query(`
      ALTER TABLE "stand_code"
      ADD CONSTRAINT "FK_stand_code_shop_order"
        FOREIGN KEY ("shopOrderId")
        REFERENCES "shop_order"("id")
        ON DELETE SET NULL,
      ADD CONSTRAINT "FK_stand_code_sales_partner"
        FOREIGN KEY ("salesPartnerId")
        REFERENCES "sales_partner"("id")
        ON DELETE SET NULL
    `)

    /*
     * Once a café is attributed, the
     * Business row becomes the authoritative
     * source for future restaurant-order
     * commissions.
     *
     * salesCommissionBps snapshots the rate
     * so changing a partner's default rate
     * cannot silently rewrite an existing
     * café's agreement.
     */
    await queryRunner.query(`
      ALTER TABLE "business"
      ADD COLUMN "salesPartnerId" integer,
      ADD COLUMN "salesCommissionBps" integer,
      ADD COLUMN "salesAttributionSource"
        varchar(32),
      ADD COLUMN "salesAttributedAt"
        TIMESTAMPTZ,
      ADD COLUMN "salesAttributionLockedAt"
        TIMESTAMPTZ
    `)

    await queryRunner.query(`
      ALTER TABLE "business"
      ADD CONSTRAINT "CHK_business_sales_commission_bps"
        CHECK (
          "salesCommissionBps" IS NULL
          OR (
            "salesCommissionBps" >= 0
            AND "salesCommissionBps" <= 10000
          )
        ),
      ADD CONSTRAINT "FK_business_sales_partner"
        FOREIGN KEY ("salesPartnerId")
        REFERENCES "sales_partner"("id")
        ON DELETE SET NULL
    `)

    await queryRunner.query(`
      CREATE INDEX
        "IDX_sales_partner_status"
      ON "sales_partner" ("status")
    `)

    await queryRunner.query(`
      CREATE INDEX
        "IDX_sales_partner_created"
      ON "sales_partner" ("createdAt" DESC)
    `)

    await queryRunner.query(`
      CREATE INDEX
        "IDX_sales_commission_partner_status_available"
      ON "sales_commission" (
        "salesPartnerId",
        "status",
        "availableAt"
      )
    `)

    await queryRunner.query(`
      CREATE INDEX
        "IDX_sales_commission_business_created"
      ON "sales_commission" (
        "businessId",
        "createdAt" DESC
      )
    `)

    await queryRunner.query(`
      CREATE INDEX
        "IDX_sales_payout_partner_created"
      ON "sales_payout" (
        "salesPartnerId",
        "createdAt" DESC
      )
    `)

    await queryRunner.query(`
      CREATE INDEX
        "IDX_sales_audit_partner_created"
      ON "sales_audit_log" (
        "salesPartnerId",
        "createdAt" DESC
      )
    `)

    await queryRunner.query(`
      CREATE INDEX
        "IDX_shop_order_sales_partner_created"
      ON "shop_order" (
        "salesPartnerId",
        "createdAt" DESC
      )
    `)

    await queryRunner.query(`
      CREATE INDEX
        "IDX_stand_code_shop_order"
      ON "stand_code" ("shopOrderId")
    `)

    await queryRunner.query(`
      CREATE INDEX
        "IDX_stand_code_sales_partner"
      ON "stand_code" ("salesPartnerId")
    `)

    await queryRunner.query(`
      CREATE INDEX
        "IDX_business_sales_partner"
      ON "business" ("salesPartnerId")
    `)
  }

  public async down(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS
        "IDX_business_sales_partner"
    `)

    await queryRunner.query(`
      ALTER TABLE "business"
      DROP CONSTRAINT IF EXISTS
        "FK_business_sales_partner",
      DROP CONSTRAINT IF EXISTS
        "CHK_business_sales_commission_bps"
    `)

    await queryRunner.query(`
      ALTER TABLE "business"
      DROP COLUMN IF EXISTS
        "salesAttributionLockedAt",
      DROP COLUMN IF EXISTS
        "salesAttributedAt",
      DROP COLUMN IF EXISTS
        "salesAttributionSource",
      DROP COLUMN IF EXISTS
        "salesCommissionBps",
      DROP COLUMN IF EXISTS
        "salesPartnerId"
    `)

    await queryRunner.query(`
      DROP INDEX IF EXISTS
        "IDX_stand_code_sales_partner"
    `)

    await queryRunner.query(`
      DROP INDEX IF EXISTS
        "IDX_stand_code_shop_order"
    `)

    await queryRunner.query(`
      ALTER TABLE "stand_code"
      DROP CONSTRAINT IF EXISTS
        "FK_stand_code_sales_partner",
      DROP CONSTRAINT IF EXISTS
        "FK_stand_code_shop_order"
    `)

    await queryRunner.query(`
      ALTER TABLE "stand_code"
      DROP COLUMN IF EXISTS
        "salesAttributionSource",
      DROP COLUMN IF EXISTS
        "salesPartnerId",
      DROP COLUMN IF EXISTS
        "shopOrderId"
    `)

    await queryRunner.query(`
      DROP INDEX IF EXISTS
        "IDX_shop_order_sales_partner_created"
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      DROP CONSTRAINT IF EXISTS
        "FK_shop_order_sales_partner",
      DROP CONSTRAINT IF EXISTS
        "CHK_shop_order_sales_discount"
    `)

    await queryRunner.query(`
      ALTER TABLE "shop_order"
      DROP COLUMN IF EXISTS
        "salesDiscountCents",
      DROP COLUMN IF EXISTS
        "salesCode",
      DROP COLUMN IF EXISTS
        "salesPartnerId"
    `)

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "sales_audit_log"
    `)

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "sales_payout_item"
    `)

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "sales_payout"
    `)

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "sales_commission"
    `)

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "sales_partner_agreement"
    `)

    await queryRunner.query(`
      DROP TABLE IF EXISTS
        "sales_partner"
    `)
  }
}
