export function getToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

export function requireAuth(router: any) {
  const token = getToken()
  if (!token) {
    router.push('/login')
  }
}