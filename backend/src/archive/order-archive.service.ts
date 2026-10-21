import {
  Injectable,
  Logger,
} from '@nestjs/common'

import {
  ConfigService,
} from '@nestjs/config'

import {
  DataSource,
} from 'typeorm'

import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

import {
  createHash,
} from 'crypto'

import {
  gzipSync,
} from 'zlib'

type ArchiveRow = {
  orderId: number
  businessId: number
  storeCode: string | null

  createdAt: Date | string
  paidAt: Date | string | null

  currency: string
  status: string

  grossCents: string
  platformFeeCents: string
  stripeFeeCents: string
  refundCents: string

  stripePaymentIntentId: string | null
  stripeSessionId: string | null
  stripeChargeId: string | null
  stripeBalanceTransactionId: string | null
  stripeTransferId: string | null
  stripeApplicationFeeId: string | null

  refundId: string | null
  stripeRefundStatus: string | null
  refundAt: Date | string | null

  applicationFeeRefundId: string | null
  transferReversalId: string | null

  paymentProcessingVersion: number

  salesPartnerId: number | null
  commissionBps: number | null
  commissionUnits: string | null
  commissionStatus: string | null
  commissionEarnedAt: Date | string | null
  commissionCapApplied: boolean | null
}

@Injectable()
export class OrderArchiveService {
  private readonly logger =
    new Logger(
      OrderArchiveService.name,
    )

  private readonly bucket: string
  private readonly region: string

  private readonly archiveDays: number
  private readonly batchSize: number

  private readonly s3: S3Client

  constructor(
    private readonly dataSource:
      DataSource,

    private readonly config:
      ConfigService,
  ) {
    this.bucket =
      String(
        this.config.get<string>(
          'CAVIARQR_ARCHIVE_BUCKET',
        ) || '',
      ).trim()

    this.region =
      String(
        this.config.get<string>(
          'AWS_REGION',
        ) || 'us-west-2',
      ).trim()

    this.archiveDays =
      Number(
        this.config.get<string>(
          'CAVIARQR_ARCHIVE_AFTER_DAYS',
        ) || '60',
      )

    this.batchSize =
      Number(
        this.config.get<string>(
          'CAVIARQR_ARCHIVE_BATCH_SIZE',
        ) || '10000',
      )

    this.s3 =
      new S3Client({
        region:
          this.region,
      })
  }

  private sha256(
    value: Buffer | string,
  ) {
    return createHash('sha256')
      .update(value)
      .digest('hex')
  }

  private eligibilitySql() {
    return `
      o."archivedAt" IS NULL

      AND
      o."createdAt" < $1

      AND
      o.status::text
        IN (
          'DONE',
          'REFUNDED'
        )

      AND NOT (
        o."refundRequested" = true
        AND
        o."refundProcessed" = false
      )

      AND NOT (
        o."requiresOwnerAction" = true
        AND
        o."issueResolved" = false
      )

      AND NOT EXISTS (
        SELECT 1
        FROM "refund_attempt" ra
        WHERE
          ra."orderId" = o.id
          AND
          ra.status::text
            IN (
              'REQUESTED',
              'PROCESSING',
              'PENDING',
              'RECONCILIATION_REQUIRED'
            )
      )

      AND NOT EXISTS (
        SELECT 1
        FROM "support_thread" st
        WHERE
          st."orderId" = o.id
          AND
          st.status::text
            NOT IN (
              'RESOLVED',
              'REFUNDED'
            )
      )

      AND NOT EXISTS (
        SELECT 1
        FROM "order_retention_hold" h
        WHERE
          h."orderId" = o.id
          AND
          h."releasedAt" IS NULL
      )
    `
  }

  private cutoff() {
    return new Date(
      Date.now() -
        this.archiveDays *
          24 *
          60 *
          60 *
          1000,
    )
  }

  async status() {
    const cutoff =
      this.cutoff()

    const rows =
      await this.dataSource.query(
        `
        SELECT
          COUNT(*)::integer
            AS "totalOrders",

          COUNT(*) FILTER (
            WHERE
              o."archivedAt"
                IS NOT NULL
          )::integer
            AS "archivedOrders",

          COUNT(*) FILTER (
            WHERE
              ${this.eligibilitySql()}
          )::integer
            AS "eligibleOrders"

        FROM "order" o
        `,
        [
          cutoff,
        ],
      )

    const manifests =
      await this.dataSource.query(
        `
        SELECT
          COUNT(*)::integer
            AS "verifiedBatches",

          COALESCE(
            SUM("sourceRowCount"),
            0
          )::integer
            AS "verifiedRows"

        FROM
          "order_archive_manifest"

        WHERE
          status = 'VERIFIED'
        `,
      )

    return {
      bucket:
        this.bucket,

      region:
        this.region,

      archiveDays:
        this.archiveDays,

      ...(rows[0] || {}),

      ...(manifests[0] || {}),
    }
  }

  async archiveAll(
    maxBatches = 100,
  ) {
    if (!this.bucket) {
      throw new Error(
        'CAVIARQR_ARCHIVE_BUCKET is required.',
      )
    }

    if (
      !Number.isInteger(
        this.archiveDays,
      ) ||
      this.archiveDays < 1
    ) {
      throw new Error(
        'CAVIARQR_ARCHIVE_AFTER_DAYS must be a positive integer.',
      )
    }

    if (
      !Number.isInteger(
        this.batchSize,
      ) ||
      this.batchSize < 1 ||
      this.batchSize > 100000
    ) {
      throw new Error(
        'CAVIARQR_ARCHIVE_BATCH_SIZE must be between 1 and 100000.',
      )
    }

    if (
      !Number.isInteger(
        maxBatches,
      ) ||
      maxBatches < 1 ||
      maxBatches > 1000
    ) {
      throw new Error(
        'maxBatches must be between 1 and 1000.',
      )
    }

    /*
     * Freeze one cutoff for this entire run.
     * A long-running job must not move its
     * eligibility boundary between batches.
     */
    const cutoff =
      this.cutoff()

    /*
     * PostgreSQL advisory locks are session scoped.
     * Keep one dedicated QueryRunner connection for
     * acquisition, the complete archive run, and
     * release.
     */
    const lockRunner =
      this.dataSource
        .createQueryRunner()

    await lockRunner.connect()

    let locked =
      false

    try {
      const lock =
        await lockRunner.query(
          `
          SELECT
            pg_try_advisory_lock(
              hashtext(
                'caviarqr_order_archive_v1'
              )
            ) AS locked
          `,
        )

      if (!lock?.[0]?.locked) {
        return {
          archived: 0,
          batches: 0,
          reason:
            'archive-lock-busy',
        }
      }

      locked =
        true

      let archived =
        0

      let batches =
        0

      const batchIds:
        string[] = []

      for (
        let i = 0;
        i < maxBatches;
        i += 1
      ) {
        const result =
          await this.archiveOneBatch(
            cutoff,
          )

        if (!result) {
          break
        }

        archived +=
          result.rowCount

        batches += 1

        batchIds.push(
          result.batchId,
        )
      }

      return {
        archived,
        batches,
        batchIds,
        cutoff:
          cutoff.toISOString(),
      }
    } finally {
      try {
        if (locked) {
          await lockRunner.query(
            `
            SELECT
              pg_advisory_unlock(
                hashtext(
                  'caviarqr_order_archive_v1'
                )
              )
            `,
          )
        }
      } finally {
        await lockRunner.release()
      }
    }
  }

  private async archiveOneBatch(
    cutoff: Date,
  ) {

    const rows:
      Array<
        ArchiveRow & {
          orderUpdatedAt: string
          salesCommissionId:
            string | null
          salesCommissionUpdatedAt:
            string | null
        }
      > =
      await this.dataSource.query(
        `
        WITH oldest_partition AS (
          SELECT
            date_trunc(
              'month',
              o."createdAt"
                AT TIME ZONE 'UTC'
            ) AS month_start,

            LOWER(o.currency)
              AS currency

          FROM "order" o

          WHERE
            ${this.eligibilitySql()}

          ORDER BY
            o."createdAt",
            o.id

          LIMIT 1
        )

        SELECT
          o.id
            AS "orderId",

          o."businessId"
            AS "businessId",

          o."storeCode"
            AS "storeCode",

          o."createdAt"
            AS "createdAt",

          o."paidAt"
            AS "paidAt",

          o."updatedAt"::text
            AS "orderUpdatedAt",

          LOWER(o.currency)
            AS currency,

          o.status::text
            AS status,

          ROUND(
            o.total * 100
          )::bigint::text
            AS "grossCents",

          ROUND(
            o."platformFee" * 100
          )::bigint::text
            AS "platformFeeCents",

          COALESCE(
            ROUND(
              o."stripeFee" * 100
            ),
            0
          )::bigint::text
            AS "stripeFeeCents",

          COALESCE(
            ROUND(
              o."refundAmount" * 100
            ),
            0
          )::bigint::text
            AS "refundCents",

          o."stripePaymentIntentId"
            AS "stripePaymentIntentId",

          o."stripeSessionId"
            AS "stripeSessionId",

          o."stripeChargeId"
            AS "stripeChargeId",

          o."stripeBalanceTransactionId"
            AS "stripeBalanceTransactionId",

          o."stripeTransferId"
            AS "stripeTransferId",

          o."stripeApplicationFeeId"
            AS "stripeApplicationFeeId",

          o."refundId"
            AS "refundId",

          o."stripeRefundStatus"
            AS "stripeRefundStatus",

          o."refundAt"
            AS "refundAt",

          o."applicationFeeRefundId"
            AS "applicationFeeRefundId",

          o."transferReversalId"
            AS "transferReversalId",

          o."paymentProcessingVersion"
            AS "paymentProcessingVersion",

          sc.id::text
            AS "salesCommissionId",

          sc."updatedAt"::text
            AS "salesCommissionUpdatedAt",

          sc."salesPartnerId"
            AS "salesPartnerId",

          sc."commissionBps"
            AS "commissionBps",

          sc."commissionUnits"::text
            AS "commissionUnits",

          sc.status::text
            AS "commissionStatus",

          sc."earnedAt"
            AS "commissionEarnedAt",

          sc."capApplied"
            AS "commissionCapApplied"

        FROM "order" o

        LEFT JOIN
          "sales_commission" sc
        ON
          sc."orderId" = o.id

        WHERE
          ${this.eligibilitySql()}

          AND
          date_trunc(
            'month',
            o."createdAt"
              AT TIME ZONE 'UTC'
          ) = (
            SELECT month_start
            FROM oldest_partition
          )

          AND
          LOWER(o.currency) = (
            SELECT currency
            FROM oldest_partition
          )

        ORDER BY
          o."createdAt",
          o.id

        LIMIT $2
        `,
        [
          cutoff,
          this.batchSize,
        ],
      )

    if (!rows.length) {
      return null
    }

    const normalized =
      rows.map(
        row => ({
          schemaVersion: 1,

          orderId:
            Number(row.orderId),

          businessId:
            Number(
              row.businessId,
            ),

          storeCode:
            row.storeCode,

          createdAt:
            new Date(
              row.createdAt,
            ).toISOString(),

          paidAt:
            row.paidAt
              ? new Date(
                  row.paidAt,
                ).toISOString()
              : null,

          sourceOrderUpdatedAt:
            row.orderUpdatedAt,

          currency:
            row.currency,

          status:
            row.status,

          grossCents:
            String(
              row.grossCents,
            ),

          platformFeeCents:
            String(
              row.platformFeeCents,
            ),

          stripeFeeCents:
            String(
              row.stripeFeeCents,
            ),

          refundCents:
            String(
              row.refundCents,
            ),

          stripePaymentIntentId:
            row.stripePaymentIntentId,

          stripeSessionId:
            row.stripeSessionId,

          stripeChargeId:
            row.stripeChargeId,

          stripeBalanceTransactionId:
            row.stripeBalanceTransactionId,

          stripeTransferId:
            row.stripeTransferId,

          stripeApplicationFeeId:
            row.stripeApplicationFeeId,

          refundId:
            row.refundId,

          stripeRefundStatus:
            row.stripeRefundStatus,

          refundAt:
            row.refundAt
              ? new Date(
                  row.refundAt,
                ).toISOString()
              : null,

          applicationFeeRefundId:
            row.applicationFeeRefundId,

          transferReversalId:
            row.transferReversalId,

          paymentProcessingVersion:
            Number(
              row.paymentProcessingVersion,
            ),

          salesCommissionId:
            row.salesCommissionId,

          salesCommissionUpdatedAt:
            row.salesCommissionUpdatedAt,

          salesPartnerId:
            row.salesPartnerId ===
            null
              ? null
              : Number(
                  row.salesPartnerId,
                ),

          commissionBps:
            row.commissionBps ===
            null
              ? null
              : Number(
                  row.commissionBps,
                ),

          commissionUnits:
            row.commissionUnits,

          commissionStatus:
            row.commissionStatus,

          commissionEarnedAt:
            row.commissionEarnedAt
              ? new Date(
                  row.commissionEarnedAt,
                ).toISOString()
              : null,

          commissionCapApplied:
            row.commissionCapApplied,
        }),
      )

    const currencies =
      [
        ...new Set(
          normalized.map(
            row =>
              row.currency,
          ),
        ),
      ]

    if (
      currencies.length !== 1
    ) {
      throw new Error(
        `Archive batch contains multiple currencies: ${currencies.join(',')}`,
      )
    }

    const batchCurrency =
      String(
        currencies[0],
      ).toLowerCase()

    if (
      !/^[a-z0-9][a-z0-9_-]{2,7}$/
        .test(
          batchCurrency,
        )
    ) {
      throw new Error(
        `Invalid archive currency: ${batchCurrency}`,
      )
    }

    const ndjson =
      normalized
        .map(
          row =>
            JSON.stringify(row),
        )
        .join('\n') +
      '\n'

    const rawSha256 =
      this.sha256(ndjson)

    const compressed =
      gzipSync(
        Buffer.from(
          ndjson,
          'utf8',
        ),
        {
          level: 9,
        },
      )

    const compressedSha256 =
      this.sha256(
        compressed,
      )

    const batchId =
      rawSha256

    const firstDate =
      new Date(
        normalized[0]
          .createdAt,
      )

    const year =
      firstDate
        .getUTCFullYear()

    const month =
      String(
        firstDate
          .getUTCMonth() + 1,
      ).padStart(
        2,
        '0',
      )

    const s3Key =
      `orders/year=${year}/month=${month}/currency=${batchCurrency}/batch-${batchId}.ndjson.gz`

    const checksumSha256Base64 =
      createHash('sha256')
        .update(compressed)
        .digest('base64')

    let objectCreatedNow =
      false

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket:
            this.bucket,

          Key:
            s3Key,

          Body:
            compressed,

          /*
           * Never overwrite an existing archive
           * object with the same deterministic key.
           */
          IfNoneMatch:
            '*',

          /*
           * S3 validates this checksum while
           * receiving the object.
           */
          ChecksumSHA256:
            checksumSha256Base64,

          StorageClass:
            'DEEP_ARCHIVE',

          ServerSideEncryption:
            'AES256',

          ContentType:
            'application/x-ndjson',

          ContentEncoding:
            'gzip',

          Tagging:
            'retention=standard&type=order-financial-archive',

          Metadata: {
            sha256:
              compressedSha256,

            'raw-sha256':
              rawSha256,

            'row-count':
              String(
                normalized.length,
              ),

            'batch-id':
              batchId,

            'schema-version':
              '1',

            currency:
              batchCurrency,
          },
        }),
      )

      objectCreatedNow =
        true
    } catch (error: unknown) {
      const httpStatusCode =
        (
          error as {
            $metadata?: {
              httpStatusCode?: number
            }
          }
        ).$metadata
          ?.httpStatusCode

      /*
       * 412 means this deterministic key already
       * exists. Do not overwrite it. Verify that
       * the existing object represents the exact
       * same archive batch before continuing.
       */
      if (
        httpStatusCode !== 412
      ) {
        throw error
      }

      this.logger.warn(
        `ORDER_ARCHIVE_OBJECT_ALREADY_EXISTS key=${s3Key}; verifying existing object`,
      )
    }

    const head =
      await this.s3.send(
        new HeadObjectCommand({
          Bucket:
            this.bucket,

          Key:
            s3Key,

          ChecksumMode:
            'ENABLED',
        }),
      )

    const s3ChecksumHex =
      head.ChecksumSHA256
        ? Buffer.from(
            head.ChecksumSHA256,
            'base64',
          ).toString(
            'hex',
          )
        : null

    const storedCompressedSha256 =
      head.Metadata?.sha256 ||
      null

    if (
      head.StorageClass !==
        'DEEP_ARCHIVE' ||

      head.ServerSideEncryption !==
        'AES256' ||

      head.Metadata?.[
        'raw-sha256'
      ] !== rawSha256 ||

      head.Metadata?.[
        'batch-id'
      ] !== batchId ||

      head.Metadata?.[
        'schema-version'
      ] !== '1' ||

      head.Metadata?.currency !==
        batchCurrency ||

      Number(
        head.Metadata?.[
          'row-count'
        ],
      ) !== normalized.length ||

      Number(
        head.ContentLength,
      ) <= 0 ||

      !storedCompressedSha256 ||

      !s3ChecksumHex ||

      storedCompressedSha256 !==
        s3ChecksumHex ||

      (
        objectCreatedNow &&
        storedCompressedSha256 !==
          compressedSha256
      )
    ) {
      throw new Error(
        `Archive verification failed: ${s3Key}`,
      )
    }

    const totals =
      normalized.reduce(
        (
          acc,
          row,
        ) => {
          acc.gross +=
            BigInt(
              row.grossCents,
            )

          acc.platform +=
            BigInt(
              row.platformFeeCents,
            )

          acc.stripe +=
            BigInt(
              row.stripeFeeCents,
            )

          acc.refund +=
            BigInt(
              row.refundCents,
            )

          acc.commission +=
            BigInt(
              row.commissionUnits ||
                '0',
            )

          return acc
        },
        {
          gross:
            0n,

          platform:
            0n,

          stripe:
            0n,

          refund:
            0n,

          commission:
            0n,
        },
      )

    const ids =
      normalized.map(
        row =>
          row.orderId,
      )

    const qr =
      this.dataSource
        .createQueryRunner()

    await qr.connect()
    await qr.startTransaction()

    try {
      /*
       * Prevent commission writes during this short
       * verification + commit transaction.
       */
      await qr.query(
        `
        LOCK TABLE
          "sales_commission"
        IN SHARE MODE
        `,
      )

      /*
       * Lock the selected order rows and prove their
       * updatedAt values still exactly match what was
       * copied to S3.
       */
      const currentOrders:
        Array<{
          id: number
          orderUpdatedAt: string
        }> =
        await qr.query(
          `
          SELECT
            id,
            "updatedAt"::text
              AS "orderUpdatedAt"

          FROM "order"

          WHERE
            id = ANY(
              $1::integer[]
            )

          ORDER BY id

          FOR UPDATE
          `,
          [
            ids,
          ],
        )

      const expectedOrderVersions =
        normalized
          .map(
            row =>
              `${row.orderId}|${row.sourceOrderUpdatedAt}`,
          )
          .sort()

      const currentOrderVersions =
        currentOrders
          .map(
            row =>
              `${Number(row.id)}|${row.orderUpdatedAt}`,
          )
          .sort()

      if (
        expectedOrderVersions.length !==
          currentOrderVersions.length ||
        expectedOrderVersions.some(
          (
            value,
            index,
          ) =>
            value !==
              currentOrderVersions[
                index
              ],
        )
      ) {
        throw new Error(
          'Archive source order changed during S3 upload.',
        )
      }

      /*
       * Do the same for sales commission evidence.
       * Absence of a commission row is also part of
       * the snapshot.
       */
      const currentCommissions:
        Array<{
          orderId: number
          salesCommissionId: string
          salesCommissionUpdatedAt: string
        }> =
        await qr.query(
          `
          SELECT
            "orderId",
            id::text
              AS "salesCommissionId",
            "updatedAt"::text
              AS "salesCommissionUpdatedAt"

          FROM "sales_commission"

          WHERE
            "orderId" = ANY(
              $1::integer[]
            )

          ORDER BY
            "orderId"

          FOR UPDATE
          `,
          [
            ids,
          ],
        )

      const expectedCommissionVersions =
        normalized
          .filter(
            row =>
              row.salesCommissionId !==
                null,
          )
          .map(
            row =>
              `${row.orderId}|${row.salesCommissionId}|${row.salesCommissionUpdatedAt}`,
          )
          .sort()

      const currentCommissionVersions =
        currentCommissions
          .map(
            row =>
              `${Number(row.orderId)}|${row.salesCommissionId}|${row.salesCommissionUpdatedAt}`,
          )
          .sort()

      if (
        expectedCommissionVersions.length !==
          currentCommissionVersions.length ||
        expectedCommissionVersions.some(
          (
            value,
            index,
          ) =>
            value !==
              currentCommissionVersions[
                index
              ],
        )
      ) {
        throw new Error(
          'Archive sales commission source changed during S3 upload.',
        )
      }

      const updated =
        await qr.query(
          `
          UPDATE "order" o

          SET
            "archivedAt" = NOW(),
            "archiveBatchId" = $3

          WHERE
            o.id =
              ANY(
                $2::integer[]
              )

            AND
            ${this.eligibilitySql()}

          RETURNING o.id
          `,
          [
            cutoff,
            ids,
            batchId,
          ],
        )

      /*
       * TypeORM's PostgreSQL QueryRunner returns
       * UPDATE ... RETURNING as:
       *
       *   [returnedRows, affectedRowCount]
       *
       * while INSERT ... RETURNING returns the
       * returned-row array directly.
       */
      const updatedRows:
        Array<{
          id: number
        }> =
        (
          Array.isArray(updated) &&
          updated.length === 2 &&
          Array.isArray(updated[0]) &&
          typeof updated[1] === 'number'
        )
          ? updated[0]
          : updated

      const updatedCount =
        Array.isArray(updatedRows)
          ? updatedRows.length
          : -1

      if (
        updatedCount !==
        normalized.length
      ) {
        throw new Error(
          `Archive source changed during upload. Expected ${normalized.length}, updated ${updatedCount}.`,
        )
      }

      const manifestRows =
        await qr.query(
        `
        INSERT INTO
          "order_archive_manifest"
          AS manifest (
            "batchId",
            "s3Bucket",
            "s3Key",
            "storageClass",
            "sha256",
            "uncompressedSha256",
            "sourceRowCount",
            "firstOrderId",
            "lastOrderId",
            "cutoffAt",
            "oldestOrderAt",
            "newestOrderAt",
            "grossCents",
            "platformFeeCents",
            "stripeFeeCents",
            "refundCents",
            "commissionUnits",
            "currency",
            "status",
            "verifiedAt"
          )

        VALUES (
          $1,
          $2,
          $3,
          'DEEP_ARCHIVE',
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16,
          $17,
          'VERIFIED',
          NOW()
        )

        ON CONFLICT (
          "batchId"
        )
        DO UPDATE SET
          "verifiedAt" =
            EXCLUDED."verifiedAt",

          "status" =
            'VERIFIED'

        WHERE
          manifest."s3Bucket" =
            EXCLUDED."s3Bucket"

          AND manifest."s3Key" =
            EXCLUDED."s3Key"

          AND manifest."storageClass" =
            EXCLUDED."storageClass"

          AND manifest."sha256" =
            EXCLUDED."sha256"

          AND manifest."uncompressedSha256" =
            EXCLUDED."uncompressedSha256"

          AND manifest."sourceRowCount" =
            EXCLUDED."sourceRowCount"

          AND manifest."firstOrderId" =
            EXCLUDED."firstOrderId"

          AND manifest."lastOrderId" =
            EXCLUDED."lastOrderId"

          AND manifest."oldestOrderAt" =
            EXCLUDED."oldestOrderAt"

          AND manifest."newestOrderAt" =
            EXCLUDED."newestOrderAt"

          AND manifest."grossCents" =
            EXCLUDED."grossCents"

          AND manifest."platformFeeCents" =
            EXCLUDED."platformFeeCents"

          AND manifest."stripeFeeCents" =
            EXCLUDED."stripeFeeCents"

          AND manifest."refundCents" =
            EXCLUDED."refundCents"

          AND manifest."commissionUnits" =
            EXCLUDED."commissionUnits"

          AND manifest."currency" =
            EXCLUDED."currency"

        RETURNING
          "batchId"
        `,
        [
          batchId,
          this.bucket,
          s3Key,
          storedCompressedSha256,
          rawSha256,
          normalized.length,
          normalized[0]
            .orderId,
          normalized[
            normalized.length - 1
          ].orderId,
          cutoff,
          normalized[0]
            .createdAt,
          normalized[
            normalized.length - 1
          ].createdAt,
          totals.gross.toString(),
          totals.platform.toString(),
          totals.stripe.toString(),
          totals.refund.toString(),
          totals.commission.toString(),
          batchCurrency,
        ],
      )

      if (!manifestRows.length) {
        throw new Error(
          `Archive manifest conflict for batch ${batchId}.`,
        )
      }

      await qr.commitTransaction()
    } catch (error) {
      await qr.rollbackTransaction()
      throw error
    } finally {
      await qr.release()
    }

    this.logger.log(
      `ORDER_ARCHIVE_VERIFIED batch=${batchId} rows=${normalized.length} key=${s3Key}`,
    )

    return {
      batchId,
      rowCount:
        normalized.length,
      s3Key,
    }
  }
}
