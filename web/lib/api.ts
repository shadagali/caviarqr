const MAINTENANCE_TOKEN_KEY =
  'caviarqr_maintenance_token'

export function getMaintenanceToken() {
  if (typeof window === 'undefined') {
    return ''
  }

  return (
    localStorage.getItem(
      MAINTENANCE_TOKEN_KEY,
    ) || ''
  )
}

export function setMaintenanceToken(
  token: string,
) {
  if (typeof window === 'undefined') {
    return
  }

  localStorage.setItem(
    MAINTENANCE_TOKEN_KEY,
    token,
  )
}

export function clearMaintenanceToken() {
  if (typeof window === 'undefined') {
    return
  }

  localStorage.removeItem(
    MAINTENANCE_TOKEN_KEY,
  )
}

function shouldAttachMaintenanceToken(
  url: string,
) {
  return (
    url.includes('/maintenance') &&
    !url.includes('/maintenance-auth')
  )
}

export async function apiFetch(
  url: string,
  options: RequestInit = {},
) {
  try {
    const headers =
      new Headers(options.headers || {})

    if (
      options.body &&
      !headers.has('Content-Type')
    ) {
      headers.set(
        'Content-Type',
        'application/json',
      )
    }

    if (
      shouldAttachMaintenanceToken(
        url,
      )
    ) {
      const token =
        getMaintenanceToken()

      if (token) {
        headers.set(
          'Authorization',
          `Bearer ${token}`,
        )
      }
    }

    const res = await fetch(url, {
      ...options,
      headers,
    })

    const data =
      await res
        .json()
        .catch(() => ({}))

    if (!res.ok) {
      if (
        res.status === 401 &&
        shouldAttachMaintenanceToken(
          url,
        )
      ) {
        clearMaintenanceToken()

        if (
          typeof window !==
          'undefined'
        ) {
          window.location.href =
            '/dashboard/maintenance/login'
        }
      }

      return {
        success: false,
        message:
          data.message ||
          'Request failed',
        statusCode:
          res.status,
      }
    }

    return {
      success: true,
      ...data,
    }
  } catch (err: any) {
    console.log('API ERROR:', err)

    return {
      success: false,
      message: 'Network error',
    }
  }
}