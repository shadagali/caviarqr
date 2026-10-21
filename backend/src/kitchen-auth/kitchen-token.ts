import {
  createHmac,
  timingSafeEqual,
} from 'crypto'

export type KitchenSession = {
  role: 'kitchen'
  businessId: number
  storeCode: string
  passwordVersion: string
  iat: number
  exp: number
}

const DEFAULT_TTL_SECONDS =
  12 * 60 * 60

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

export function getKitchenTokenSecret() {
  const production =
    process.env.NODE_ENV ===
    'production'

  const secret =
    production
      ? process.env
          .KITCHEN_TOKEN_SECRET
      : process.env
          .KITCHEN_TOKEN_SECRET ||
        process.env.JWT_SECRET

  if (
    !secret ||
    secret.length < 32
  ) {
    throw new Error(
      production
        ? 'KITCHEN_TOKEN_SECRET must be configured with at least 32 characters.'
        : 'KITCHEN_TOKEN_SECRET (or JWT_SECRET in development) must contain at least 32 characters.',
    )
  }

  return secret
}

function ttlSeconds() {
  const requested =
    Number.parseInt(
      process.env
        .KITCHEN_TOKEN_TTL_SECONDS ||
        String(
          DEFAULT_TTL_SECONDS,
        ),
      10,
    )

  if (
    !Number.isInteger(requested) ||
    requested < 15 * 60 ||
    requested > 7 * 24 * 60 * 60
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
    getKitchenTokenSecret(),
  )
    .update(segment)
    .digest('base64url')
}


export function kitchenPasswordVersion(
  passwordHash: string,
): string {
  if (!passwordHash) {
    throw new Error('Kitchen password is not configured.')
  }

  return createHmac('sha256', getKitchenTokenSecret())
    .update('caviarqr-kitchen-password-version:')
    .update(passwordHash)
    .digest('base64url')
}

export function kitchenSessionMatchesPassword(
  session: KitchenSession,
  passwordHash: string | null | undefined,
): boolean {
  if (!passwordHash || !session.passwordVersion) {
    return false
  }

  const expected = Buffer.from(
    kitchenPasswordVersion(passwordHash),
    'utf8',
  )

  const supplied = Buffer.from(
    session.passwordVersion,
    'utf8',
  )

  return expected.length === supplied.length &&
    timingSafeEqual(expected, supplied)
}

export function createKitchenToken(
  businessId: number,
  storeCode: string,
  kitchenPasswordHash: string,
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
      'Cannot create kitchen session for an invalid cafe.',
    )
  }

  const now = Math.floor(
    Date.now() / 1000,
  )

  const payload: KitchenSession = {
    role: 'kitchen',
    businessId:
      cleanBusinessId,
    storeCode:
      cleanStoreCode,
    passwordVersion: kitchenPasswordVersion(kitchenPasswordHash),
    iat: now,
    exp:
      now + ttlSeconds(),
  }

  const segment =
    base64UrlEncode(
      JSON.stringify(payload),
    )

  return `${segment}.${signSegment(
    segment,
  )}`
}

export function verifyKitchenToken(
  token: string,
): KitchenSession {
  const cleanToken =
    String(token || '').trim()

  const [segment, signature, extra] =
    cleanToken.split('.')

  if (
    !segment ||
    !signature ||
    extra
  ) {
    throw new Error(
      'Invalid kitchen session.',
    )
  }

  const expected =
    signSegment(segment)

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
      'Invalid kitchen session.',
    )
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(
      base64UrlDecode(segment),
    )
  } catch {
    throw new Error(
      'Invalid kitchen session.',
    )
  }

  const payload =
    parsed as Partial<KitchenSession>

  const now = Math.floor(
    Date.now() / 1000,
  )

  if (
    payload.role !== 'kitchen' ||
    typeof payload.passwordVersion !== 'string' ||
    !payload.passwordVersion ||
    !Number.isInteger(
      payload.businessId,
    ) ||
    Number(payload.businessId) < 1 ||
    typeof payload.storeCode !==
      'string' ||
    !payload.storeCode.trim() ||
    !Number.isInteger(payload.iat) ||
    !Number.isInteger(payload.exp) ||
    Number(payload.exp) <= now
  ) {
    throw new Error(
      'Kitchen session expired or invalid.',
    )
  }

  return {
    role: 'kitchen',
    businessId:
      Number(payload.businessId),
    storeCode:
      payload.storeCode.trim(),
    passwordVersion: payload.passwordVersion!,
    iat: Number(payload.iat),
    exp: Number(payload.exp),
  }
}

export function bearerTokenFromHeader(
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

  return match?.[1]?.trim() || ''
}
