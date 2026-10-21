import {
  createHmac,
  timingSafeEqual,
} from 'crypto'

export type SalesPartnerSession = {
  role: 'sales_partner'
  salesPartnerId: number
  referralCode: string
  iat: number
  exp: number
}

const DEFAULT_TTL_SECONDS =
  12 * 60 * 60

function getSalesPartnerTokenSecret() {
  const secret =
    String(
      process.env
        .SALES_PARTNER_TOKEN_SECRET ||
      process.env.JWT_SECRET ||
      '',
    ).trim()

  if (!secret) {
    throw new Error(
      'Sales partner session secret is not configured.',
    )
  }

  return secret
}

function ttlSeconds() {
  const requested =
    Number.parseInt(
      String(
        process.env
          .SALES_PARTNER_TOKEN_TTL_SECONDS ||
        DEFAULT_TTL_SECONDS,
      ),
      10,
    )

  if (
    !Number.isInteger(requested) ||
    requested < 15 * 60 ||
    requested >
      30 * 24 * 60 * 60
  ) {
    return DEFAULT_TTL_SECONDS
  }

  return requested
}

function signSegment(
  segment: string,
) {
  return createHmac(
    'sha256',
    getSalesPartnerTokenSecret(),
  )
    .update(
      `caviarqr-sales-partner-v1.${segment}`,
    )
    .digest('base64url')
}

export function createSalesPartnerToken(
  salesPartnerId: number,
  referralCode: string,
) {
  const cleanId =
    Number(salesPartnerId)

  const cleanReferralCode =
    String(
      referralCode || '',
    )
      .trim()
      .toUpperCase()

  if (
    !Number.isInteger(cleanId) ||
    cleanId < 1 ||
    !cleanReferralCode
  ) {
    throw new Error(
      'Cannot create sales partner session.',
    )
  }

  const now =
    Math.floor(
      Date.now() / 1000,
    )

  const payload:
    SalesPartnerSession = {
      role:
        'sales_partner',

      salesPartnerId:
        cleanId,

      referralCode:
        cleanReferralCode,

      iat:
        now,

      exp:
        now + ttlSeconds(),
    }

  const segment =
    Buffer.from(
      JSON.stringify(payload),
      'utf8',
    ).toString(
      'base64url',
    )

  return `${segment}.${signSegment(
    segment,
  )}`
}

export function verifySalesPartnerToken(
  token: string,
): SalesPartnerSession {
  const cleanToken =
    String(
      token || '',
    ).trim()

  const [
    segment,
    signature,
    extra,
  ] =
    cleanToken.split('.')

  if (
    !segment ||
    !signature ||
    extra
  ) {
    throw new Error(
      'Invalid sales partner session.',
    )
  }

  const expected =
    signSegment(
      segment,
    )

  const suppliedBuffer =
    Buffer.from(
      signature,
      'utf8',
    )

  const expectedBuffer =
    Buffer.from(
      expected,
      'utf8',
    )

  if (
    suppliedBuffer.length !==
      expectedBuffer.length ||
    !timingSafeEqual(
      suppliedBuffer,
      expectedBuffer,
    )
  ) {
    throw new Error(
      'Invalid sales partner session.',
    )
  }

  let parsed:
    unknown

  try {
    parsed =
      JSON.parse(
        Buffer.from(
          segment,
          'base64url',
        ).toString(
          'utf8',
        ),
      )
  } catch {
    throw new Error(
      'Invalid sales partner session.',
    )
  }

  const payload =
    parsed as
      Partial<SalesPartnerSession>

  const now =
    Math.floor(
      Date.now() / 1000,
    )

  if (
    payload.role !==
      'sales_partner' ||
    !Number.isInteger(
      payload.salesPartnerId,
    ) ||
    Number(
      payload.salesPartnerId,
    ) < 1 ||
    typeof payload.referralCode !==
      'string' ||
    !payload.referralCode.trim() ||
    !Number.isInteger(
      payload.iat,
    ) ||
    !Number.isInteger(
      payload.exp,
    ) ||
    Number(
      payload.exp,
    ) <= now
  ) {
    throw new Error(
      'Sales partner session expired or invalid.',
    )
  }

  return {
    role:
      'sales_partner',

    salesPartnerId:
      Number(
        payload.salesPartnerId,
      ),

    referralCode:
      payload.referralCode
        .trim()
        .toUpperCase(),

    iat:
      Number(
        payload.iat,
      ),

    exp:
      Number(
        payload.exp,
      ),
  }
}

export function salesPartnerBearerToken(
  authorization?: string,
) {
  const value =
    String(
      authorization || '',
    ).trim()

  const match =
    /^Bearer\s+(.+)$/i.exec(
      value,
    )

  return (
    match?.[1]?.trim() ||
    ''
  )
}
