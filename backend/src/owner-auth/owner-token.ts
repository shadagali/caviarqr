import {
  createHmac,
  timingSafeEqual,
} from 'crypto'

export type OwnerSession = {
  role: 'owner'
  businessId: number
  storeCode: string
  iat: number
  exp: number
}

const DEFAULT_TTL_SECONDS =
  7 * 24 * 60 * 60

function base64UrlEncode(
  value: string,
) {
  return Buffer.from(
    value,
    'utf8',
  ).toString('base64url')
}

function base64UrlDecode(
  value: string,
) {
  return Buffer.from(
    value,
    'base64url',
  ).toString('utf8')
}

function getOwnerTokenSecret() {
  const secret =
    String(
      process.env.JWT_SECRET ||
        '',
    ).trim()

  if (
    !secret ||
    secret.length < 32
  ) {
    throw new Error(
      'JWT_SECRET must contain at least 32 characters for owner sessions.',
    )
  }

  return secret
}

function ttlSeconds() {
  const requested =
    Number.parseInt(
      process.env
        .OWNER_TOKEN_TTL_SECONDS ||
        String(
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
    getOwnerTokenSecret(),
  )
    .update(segment)
    .digest('base64url')
}

export function createOwnerToken(
  businessId: number,
  storeCode: string,
) {
  const cleanBusinessId =
    Number(businessId)

  const cleanStoreCode =
    String(
      storeCode || '',
    ).trim()

  if (
    !Number.isInteger(
      cleanBusinessId,
    ) ||
    cleanBusinessId < 1 ||
    !cleanStoreCode
  ) {
    throw new Error(
      'Cannot create owner session for an invalid cafe.',
    )
  }

  const now = Math.floor(
    Date.now() / 1000,
  )

  const payload: OwnerSession = {
    role: 'owner',

    businessId:
      cleanBusinessId,

    storeCode:
      cleanStoreCode,

    iat:
      now,

    exp:
      now + ttlSeconds(),
  }

  const segment =
    base64UrlEncode(
      JSON.stringify(
        payload,
      ),
    )

  return `${segment}.${signSegment(
    segment,
  )}`
}

export function verifyOwnerToken(
  token: string,
): OwnerSession {
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
      'Invalid owner session.',
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
      'Invalid owner session.',
    )
  }

  let parsed: unknown

  try {
    parsed =
      JSON.parse(
        base64UrlDecode(
          segment,
        ),
      )
  } catch {
    throw new Error(
      'Invalid owner session.',
    )
  }

  const payload =
    parsed as
      Partial<OwnerSession>

  const now = Math.floor(
    Date.now() / 1000,
  )

  if (
    payload.role !==
      'owner' ||
    !Number.isInteger(
      payload.businessId,
    ) ||
    Number(
      payload.businessId,
    ) < 1 ||
    typeof payload
      .storeCode !==
      'string' ||
    !payload.storeCode
      .trim() ||
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
      'Owner session expired or invalid.',
    )
  }

  return {
    role: 'owner',

    businessId:
      Number(
        payload.businessId,
      ),

    storeCode:
      payload.storeCode
        .trim(),

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

export function ownerBearerToken(
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
