import {
  createHmac,
  timingSafeEqual,
} from 'crypto'

function getSupportTokenSecret() {
  const secret =
    String(
      process.env
        .SUPPORT_TOKEN_SECRET ||
        '',
    ).trim()

  if (secret.length < 32) {
    throw new Error(
      'SUPPORT_TOKEN_SECRET must be configured with at least 32 characters.',
    )
  }

  return secret
}

function signatureFor(
  threadId: string,
) {
  return createHmac(
    'sha256',
    getSupportTokenSecret(),
  )
    .update(threadId)
    .digest('base64url')
}

export function createSupportAccessToken(
  threadId: string,
) {
  const id =
    String(
      threadId || '',
    ).trim()

  if (!id) {
    throw new Error(
      'Support thread id is required.',
    )
  }

  return `${id}.${signatureFor(
    id,
  )}`
}

export function verifySupportAccessToken(
  token: string,
): string | null {
  const raw =
    String(
      token || '',
    ).trim()

  const separator =
    raw.lastIndexOf('.')

  if (
    separator <= 0 ||
    separator ===
      raw.length - 1
  ) {
    return null
  }

  const threadId =
    raw.slice(
      0,
      separator,
    )

  const suppliedSignature =
    raw.slice(
      separator + 1,
    )

  const expectedSignature =
    signatureFor(
      threadId,
    )

  const supplied =
    Buffer.from(
      suppliedSignature,
      'utf8',
    )

  const expected =
    Buffer.from(
      expectedSignature,
      'utf8',
    )

  if (
    supplied.length !==
    expected.length
  ) {
    return null
  }

  if (
    !timingSafeEqual(
      supplied,
      expected,
    )
  ) {
    return null
  }

  return threadId
}