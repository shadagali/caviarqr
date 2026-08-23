import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common'

import {
  createHmac,
  timingSafeEqual,
} from 'node:crypto'

// =====================================
// RAZORPAY TYPES
// =====================================

export type RazorpayOrder = {
  id: string
  entity: string

  amount: number
  amount_paid: number
  amount_due: number

  currency: string

  receipt:
    | string
    | null

  status:
    | 'created'
    | 'attempted'
    | 'paid'
    | string

  attempts: number

  notes:
    | Record<
        string,
        string
      >
    | []

  created_at: number
}

export type RazorpayPayment = {
  id: string
  entity: string

  amount: number

  currency: string

  status:
    | 'created'
    | 'authorized'
    | 'captured'
    | 'refunded'
    | 'failed'
    | string

  order_id:
    | string
    | null

  invoice_id?:
    | string
    | null

  method?:
    | string
    | null

  captured: boolean

  refund_status?:
    | string
    | null

  amount_refunded?:
    number

  email?:
    | string
    | null

  contact?:
    | string
    | null

  /*
   * Razorpay documents `fee`
   * as the gateway fee INCLUDING GST.
   *
   * `tax` is exposed separately for
   * reporting, so DO NOT add fee + tax
   * when calculating the actual gateway
   * deduction.
   */
  fee?:
    | number
    | null

  tax?:
    | number
    | null

  error_code?:
    | string
    | null

  error_description?:
    | string
    | null

  notes?:
    | Record<
        string,
        string
      >
    | []

  created_at?: number
}

export type RazorpayTransfer = {
  id: string
  entity: string

  /*
   * Razorpay documentation has used
   * both `status` and `transfer_status`
   * in responses over time.
   *
   * Keep both so the integration is
   * defensive.
   */
  status?:
    | string
    | null

  transfer_status?:
    | string
    | null

  settlement_status?:
    | string
    | null

  source:
    | string
    | null

  recipient:
    | string
    | null

  amount: number

  currency: string

  amount_reversed:
    number

  /*
   * Route transfer fees.
   * These can be used later for
   * settlement reconciliation.
   */
  fees?:
    | number
    | null

  fee?:
    | number
    | null

  tax?:
    | number
    | null

  notes?:
    | Record<
        string,
        string
      >
    | []

  on_hold?:
    boolean

  on_hold_until?:
    | number
    | null

  recipient_settlement_id?:
    | string
    | null

  created_at?:
    number

  processed_at?:
    | number
    | null

  error?:
    | {
        code?:
          | string
          | null

        description?:
          | string
          | null

        reason?:
          | string
          | null

        field?:
          | string
          | null

        step?:
          | string
          | null
      }
    | null
}

export type RazorpayTransferCollection = {
  entity: string
  count: number

  items:
    RazorpayTransfer[]
}

type RazorpayApiErrorResponse = {
  error?: {
    code?: string

    description?:
      string

    source?:
      string

    step?:
      string

    reason?:
      string

    field?:
      string
  }
}

type CreateOrderInput = {
  amountPaise: number

  receipt: string

  notes?: Record<
    string,
    string
  >
}

type CreateTransferInput = {
  paymentId: string

  linkedAccountId:
    string

  amountPaise:
    number

  notes?: Record<
    string,
    string
  >

  onHold?:
    boolean

  onHoldUntil?:
    number
}

// =====================================
// SERVICE
// =====================================

@Injectable()
export class RazorpayApiService {
  private readonly logger =
    new Logger(
      RazorpayApiService.name,
    )

  private readonly baseUrl =
    'https://api.razorpay.com/v1'

  private readonly requestTimeoutMs =
    15_000

  // =====================================
  // CONFIG
  // =====================================

  isConfigured() {
    return Boolean(
      process.env
        .RAZORPAY_KEY_ID &&
        process.env
          .RAZORPAY_KEY_SECRET,
    )
  }

  getPublicKeyId() {
    this.assertApiConfigured()

    return String(
      process.env
        .RAZORPAY_KEY_ID,
    )
  }

  private getKeyId() {
    this.assertApiConfigured()

    return String(
      process.env
        .RAZORPAY_KEY_ID,
    )
  }

  private getKeySecret() {
    this.assertApiConfigured()

    return String(
      process.env
        .RAZORPAY_KEY_SECRET,
    )
  }

  private getWebhookSecret() {
    const secret =
      String(
        process.env
          .RAZORPAY_WEBHOOK_SECRET ||
          '',
      ).trim()

    if (!secret) {
      throw new ServiceUnavailableException(
        'Razorpay webhook verification is not configured.',
      )
    }

    return secret
  }

  private assertApiConfigured() {
    const keyId =
      String(
        process.env
          .RAZORPAY_KEY_ID ||
          '',
      ).trim()

    const keySecret =
      String(
        process.env
          .RAZORPAY_KEY_SECRET ||
          '',
      ).trim()

    if (
      !keyId ||
      !keySecret
    ) {
      throw new ServiceUnavailableException(
        'Razorpay payments are not configured.',
      )
    }
  }

  // =====================================
  // CREATE RAZORPAY ORDER
  // =====================================

  async createOrder(
    input:
      CreateOrderInput,
  ): Promise<RazorpayOrder> {
    this.assertAmount(
      input.amountPaise,
      'Order amount',
    )

    const receipt =
      this.normalizeReceipt(
        input.receipt,
      )

    const notes =
      this.normalizeNotes(
        input.notes,
      )

    /*
     * No Route transfer is created here.
     *
     * This is deliberate.
     *
     * We wait until Razorpay confirms
     * that the payment is CAPTURED.
     *
     * At that point we can fetch the
     * real Razorpay gateway fee and
     * calculate the café settlement
     * from real numbers instead of
     * guessing.
     */
    return this.request<
      RazorpayOrder
    >(
      '/orders',
      {
        method:
          'POST',

        body: {
          amount:
            input.amountPaise,

          currency:
            'INR',

          receipt,

          partial_payment:
            false,

          notes,
        },
      },
    )
  }

  // =====================================
  // FETCH RAZORPAY ORDER
  // =====================================

  async fetchOrder(
    razorpayOrderId:
      string,
  ): Promise<RazorpayOrder> {
    const orderId =
      this.normalizeRazorpayId(
        razorpayOrderId,
        'order_',
        'Razorpay order ID',
      )

    return this.request<
      RazorpayOrder
    >(
      `/orders/${encodeURIComponent(
        orderId,
      )}`,
      {
        method:
          'GET',
      },
    )
  }

  // =====================================
  // FETCH PAYMENT
  // =====================================

  async fetchPayment(
    razorpayPaymentId:
      string,
  ): Promise<RazorpayPayment> {
    const paymentId =
      this.normalizeRazorpayId(
        razorpayPaymentId,
        'pay_',
        'Razorpay payment ID',
      )

    return this.request<
      RazorpayPayment
    >(
      `/payments/${encodeURIComponent(
        paymentId,
      )}`,
      {
        method:
          'GET',
      },
    )
  }

  // =====================================
  // TRANSFER CAPTURED PAYMENT
  // TO CAFÉ LINKED ACCOUNT
  // =====================================

  async createTransferFromPayment(
    input:
      CreateTransferInput,
  ): Promise<RazorpayTransfer> {
    const paymentId =
      this.normalizeRazorpayId(
        input.paymentId,
        'pay_',
        'Razorpay payment ID',
      )

    const linkedAccountId =
      this.normalizeRazorpayId(
        input.linkedAccountId,
        'acc_',
        'Razorpay linked account ID',
      )

    this.assertAmount(
      input.amountPaise,
      'Transfer amount',
    )

    /*
     * Razorpay requires the payment
     * to be captured before a Route
     * transfer can be created.
     */
    const payment =
      await this.fetchPayment(
        paymentId,
      )

    if (
      payment.status !==
        'captured' ||
      !payment.captured
    ) {
      throw new BadRequestException(
        'Razorpay payment is not captured yet.',
      )
    }

    if (
      String(
        payment.currency ||
          '',
      ).toUpperCase() !==
      'INR'
    ) {
      throw new BadRequestException(
        'Razorpay Route transfers must use INR.',
      )
    }

    if (
      input.amountPaise >
      payment.amount
    ) {
      throw new BadRequestException(
        'Transfer amount cannot exceed the captured payment amount.',
      )
    }

    const notes =
      this.normalizeNotes(
        input.notes,
      )

    const transfer: Record<
      string,
      unknown
    > = {
      account:
        linkedAccountId,

      amount:
        input.amountPaise,

      currency:
        'INR',

      notes,
    }

    if (
      typeof input.onHold ===
      'boolean'
    ) {
      transfer.on_hold =
        input.onHold
    }

    if (
      input.onHoldUntil !==
        undefined
    ) {
      if (
        !Number.isInteger(
          input.onHoldUntil,
        ) ||
        input.onHoldUntil <= 0
      ) {
        throw new BadRequestException(
          'Transfer hold timestamp is invalid.',
        )
      }

      transfer.on_hold_until =
        input.onHoldUntil
    }

    const response =
      await this.request<
        RazorpayTransferCollection
      >(
        `/payments/${encodeURIComponent(
          paymentId,
        )}/transfers`,
        {
          method:
            'POST',

          body: {
            transfers: [
              transfer,
            ],
          },
        },
      )

    const createdTransfer =
      response.items?.[0]

    if (!createdTransfer?.id) {
      throw new BadGatewayException(
        'Razorpay did not return a transfer ID.',
      )
    }

    return createdTransfer
  }

  // =====================================
  // FETCH PAYMENT TRANSFERS
  // =====================================

  async fetchTransfersForPayment(
    razorpayPaymentId:
      string,
  ): Promise<RazorpayTransferCollection> {
    const paymentId =
      this.normalizeRazorpayId(
        razorpayPaymentId,
        'pay_',
        'Razorpay payment ID',
      )

    return this.request<
      RazorpayTransferCollection
    >(
      `/payments/${encodeURIComponent(
        paymentId,
      )}/transfers`,
      {
        method:
          'GET',
      },
    )
  }

  // =====================================
  // FETCH ONE TRANSFER
  // =====================================

  async fetchTransfer(
    razorpayTransferId:
      string,
  ): Promise<RazorpayTransfer> {
    const transferId =
      this.normalizeRazorpayId(
        razorpayTransferId,
        'trf_',
        'Razorpay transfer ID',
      )

    return this.request<
      RazorpayTransfer
    >(
      `/transfers/${encodeURIComponent(
        transferId,
      )}`,
      {
        method:
          'GET',
      },
    )
  }

  // =====================================
  // VERIFY CHECKOUT SIGNATURE
  // =====================================

  verifyCheckoutSignature(
    data: {
      /*
       * IMPORTANT:
       *
       * razorpayOrderId must come from
       * the order ID SAVED BY OUR SERVER,
       * not blindly from the browser.
       */
      razorpayOrderId:
        string

      razorpayPaymentId:
        string

      razorpaySignature:
        string
    },
  ) {
    const orderId =
      this.normalizeRazorpayId(
        data.razorpayOrderId,
        'order_',
        'Razorpay order ID',
      )

    const paymentId =
      this.normalizeRazorpayId(
        data.razorpayPaymentId,
        'pay_',
        'Razorpay payment ID',
      )

    const signature =
      String(
        data.razorpaySignature ||
          '',
      ).trim()

    if (!signature) {
      return false
    }

    const message =
      `${orderId}|${paymentId}`

    const expected =
      createHmac(
        'sha256',
        this.getKeySecret(),
      )
        .update(message)
        .digest('hex')

    return this.safeHexCompare(
      expected,
      signature,
    )
  }

  // =====================================
  // VERIFY WEBHOOK SIGNATURE
  // =====================================

  verifyWebhookSignature(
    rawBody:
      | Buffer
      | string,

    signature:
      string,
  ) {
    const suppliedSignature =
      String(
        signature || '',
      ).trim()

    if (
      !suppliedSignature
    ) {
      return false
    }

    /*
     * Razorpay webhook verification
     * MUST use the untouched raw HTTP
     * request body.
     */
    const body =
      Buffer.isBuffer(
        rawBody,
      )
        ? rawBody
        : Buffer.from(
            rawBody,
            'utf8',
          )

    const expected =
      createHmac(
        'sha256',
        this.getWebhookSecret(),
      )
        .update(body)
        .digest('hex')

    return this.safeHexCompare(
      expected,
      suppliedSignature,
    )
  }

  // =====================================
  // ACTUAL GATEWAY COST
  // =====================================

  getPaymentGatewayFeePaise(
    payment:
      RazorpayPayment,
  ) {
    /*
     * Razorpay's documented payment
     * `fee` field already includes GST.
     *
     * Do NOT calculate:
     *
     * fee + tax
     *
     * because that would double-count
     * the GST component.
     */
    const fee =
      Number(
        payment.fee || 0,
      )

    if (
      !Number.isFinite(
        fee,
      ) ||
      fee < 0
    ) {
      throw new BadGatewayException(
        'Razorpay returned an invalid payment fee.',
      )
    }

    return Math.round(
      fee,
    )
  }

  // =====================================
  // CALCULATE CAFÉ TRANSFER
  // =====================================

  calculateCafeTransferPaise(
    data: {
      paymentAmountPaise:
        number

      caviarQrFeePaise:
        number

      razorpayPaymentFeePaise:
        number

      /*
       * We keep this separate because
       * Route transfer fees are charged
       * independently by Razorpay.
       *
       * Once your exact Route commercial
       * pricing is known, this value can
       * be supplied by our settlement
       * reconciliation layer.
       */
      routeCostRecoveryPaise?:
        number
    },
  ) {
    const paymentAmount =
      Math.round(
        Number(
          data
            .paymentAmountPaise,
        ),
      )

    const caviarQrFee =
      Math.round(
        Number(
          data
            .caviarQrFeePaise,
        ),
      )

    const paymentFee =
      Math.round(
        Number(
          data
            .razorpayPaymentFeePaise,
        ),
      )

    const routeCostRecovery =
      Math.round(
        Number(
          data
            .routeCostRecoveryPaise ||
            0,
        ),
      )

    if (
      !Number.isInteger(
        paymentAmount,
      ) ||
      paymentAmount < 100
    ) {
      throw new BadRequestException(
        'Payment amount is invalid.',
      )
    }

    for (
      const value of [
        caviarQrFee,
        paymentFee,
        routeCostRecovery,
      ]
    ) {
      if (
        !Number.isInteger(
          value,
        ) ||
        value < 0
      ) {
        throw new BadRequestException(
          'Settlement fee configuration is invalid.',
        )
      }
    }

    const transferAmount =
      paymentAmount -
      caviarQrFee -
      paymentFee -
      routeCostRecovery

    /*
     * Razorpay currently requires
     * Route transfers to be at least
     * ₹1.00 / 100 paise.
     */
    if (
      transferAmount < 100
    ) {
      throw new BadRequestException(
        'The café settlement amount is too small.',
      )
    }

    return transferAmount
  }

  // =====================================
  // HTTP
  // =====================================

  private async request<T>(
    path: string,

    options: {
      method:
        | 'GET'
        | 'POST'

      body?:
        Record<
          string,
          unknown
        >
    },
  ): Promise<T> {
    this.assertApiConfigured()

    const controller =
      new AbortController()

    const timeout =
      setTimeout(
        () => {
          controller.abort()
        },
        this.requestTimeoutMs,
      )

    try {
      const response =
        await fetch(
          `${this.baseUrl}${path}`,
          {
            method:
              options.method,

            headers: {
              Authorization:
                `Basic ${Buffer.from(
                  `${this.getKeyId()}:${this.getKeySecret()}`,
                ).toString(
                  'base64',
                )}`,

              Accept:
                'application/json',

              ...(options.body
                ? {
                    'Content-Type':
                      'application/json',
                  }
                : {}),
            },

            ...(options.body
              ? {
                  body:
                    JSON.stringify(
                      options.body,
                    ),
                }
              : {}),

            signal:
              controller.signal,
          },
        )

      const responseText =
        await response.text()

      let parsed:
        unknown = null

      if (
        responseText
          .trim()
      ) {
        try {
          parsed =
            JSON.parse(
              responseText,
            )
        } catch {
          parsed =
            null
        }
      }

      if (!response.ok) {
        const apiError =
          parsed as
            | RazorpayApiErrorResponse
            | null

        const description =
          apiError?.error
            ?.description ||
          `Razorpay API request failed with HTTP ${response.status}.`

        this.logger.warn(
          `RAZORPAY_API_ERROR ${response.status}: ${description}`,
        )

        if (
          response.status ===
            401 ||
          response.status ===
            403
        ) {
          throw new ServiceUnavailableException(
            'Razorpay account authentication failed.',
          )
        }

        if (
          response.status >=
          500
        ) {
          throw new BadGatewayException(
            'Razorpay is temporarily unavailable.',
          )
        }

        throw new BadRequestException(
          description,
        )
      }

      if (
        !parsed ||
        typeof parsed !==
          'object'
      ) {
        throw new BadGatewayException(
          'Razorpay returned an invalid response.',
        )
      }

      return parsed as T
    } catch (
      error: unknown
    ) {
      if (
        error instanceof
          BadRequestException ||
        error instanceof
          BadGatewayException ||
        error instanceof
          ServiceUnavailableException
      ) {
        throw error
      }

      if (
        error instanceof Error &&
        error.name ===
          'AbortError'
      ) {
        throw new BadGatewayException(
          'Razorpay request timed out.',
        )
      }

      const message =
        error instanceof Error
          ? error.message
          : String(error)

      this.logger.error(
        `RAZORPAY_REQUEST_FAILED: ${message}`,
      )

      throw new BadGatewayException(
        'Could not communicate with Razorpay.',
      )
    } finally {
      clearTimeout(
        timeout,
      )
    }
  }

  // =====================================
  // VALIDATION
  // =====================================

  private assertAmount(
    value: number,
    fieldName: string,
  ) {
    if (
      !Number.isInteger(
        value,
      ) ||
      value < 100
    ) {
      throw new BadRequestException(
        `${fieldName} must be at least ₹1.00.`,
      )
    }
  }

  private normalizeReceipt(
    value: string,
  ) {
    const receipt =
      String(
        value || '',
      ).trim()

    if (!receipt) {
      throw new BadRequestException(
        'Razorpay receipt is required.',
      )
    }

    /*
     * Razorpay receipt:
     * - max 40 characters
     * - should be unique
     * - keep it simple ASCII
     */
    if (
      receipt.length > 40
    ) {
      throw new BadRequestException(
        'Razorpay receipt is too long.',
      )
    }

    if (
      !/^[A-Za-z0-9_-]+$/.test(
        receipt,
      )
    ) {
      throw new BadRequestException(
        'Razorpay receipt contains invalid characters.',
      )
    }

    return receipt
  }

  private normalizeNotes(
    value:
      | Record<
          string,
          string
        >
      | undefined,
  ) {
    if (!value) {
      return {}
    }

    const entries =
      Object.entries(
        value,
      )

    if (
      entries.length > 15
    ) {
      throw new BadRequestException(
        'Razorpay notes cannot contain more than 15 entries.',
      )
    }

    const normalized:
      Record<
        string,
        string
      > = {}

    for (
      const [
        rawKey,
        rawValue,
      ] of entries
    ) {
      const key =
        String(
          rawKey,
        ).trim()

      const noteValue =
        String(
          rawValue ?? '',
        ).trim()

      if (
        !key ||
        key.length > 256 ||
        noteValue.length > 256
      ) {
        throw new BadRequestException(
          'Razorpay note is invalid.',
        )
      }

      normalized[key] =
        noteValue
    }

    return normalized
  }

  private normalizeRazorpayId(
    value: string,
    prefix: string,
    fieldName: string,
  ) {
    const id =
      String(
        value || '',
      ).trim()

    if (
      !id ||
      !id.startsWith(
        prefix,
      ) ||
      id.length > 255
    ) {
      throw new BadRequestException(
        `${fieldName} is invalid.`,
      )
    }

    return id
  }

  private safeHexCompare(
    expected: string,
    supplied: string,
  ) {
    try {
      if (
        !/^[0-9a-f]+$/i.test(
          expected,
        ) ||
        !/^[0-9a-f]+$/i.test(
          supplied,
        )
      ) {
        return false
      }

      const expectedBuffer =
        Buffer.from(
          expected,
          'hex',
        )

      const suppliedBuffer =
        Buffer.from(
          supplied,
          'hex',
        )

      if (
        expectedBuffer.length !==
        suppliedBuffer.length
      ) {
        return false
      }

      return timingSafeEqual(
        expectedBuffer,
        suppliedBuffer,
      )
    } catch {
      return false
    }
  }
}