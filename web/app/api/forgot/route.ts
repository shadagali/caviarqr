import {
  NextRequest,
  NextResponse,
} from 'next/server'

const API =
  process.env.NEXT_PUBLIC_API_URL ||
  'http://127.0.0.1:3001'

export async function POST(
  request: NextRequest,
) {
  try {
    const body =
      await request.json()

    const email =
      String(
        body?.email || '',
      )
        .trim()
        .toLowerCase()

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Email is required.',
        },
        {
          status: 400,
        },
      )
    }

    const backendUrl =
      `${API.replace(/\/+$/, '')}/business/forgot-password`

    console.log(
      '🔐 FORGOT PASSWORD PROXY:',
      backendUrl,
    )

    const response =
      await fetch(
        backendUrl,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body:
            JSON.stringify({
              email,
            }),

          cache: 'no-store',
        },
      )

    const text =
      await response.text()

    let data: any

    try {
      data =
        text
          ? JSON.parse(text)
          : {}
    } catch {
      data = {
        success: false,
        message:
          text ||
          'Invalid response from backend.',
      }
    }

    return NextResponse.json(
      data,
      {
        status:
          response.status,
      },
    )
  } catch (error: any) {
    console.error(
      '❌ FORGOT PASSWORD PROXY ERROR:',
      error,
    )

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          'Backend could not be reached.',
      },
      {
        status: 502,
      },
    )
  }
}