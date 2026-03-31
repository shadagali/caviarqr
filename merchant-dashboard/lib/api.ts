export const API_URL = "http://localhost:3001"

export async function apiFetch(path: string, options: any = {}) {

  const token = localStorage.getItem("token")

  const res = await fetch(`${API_URL}${path}`, {

    ...options,

    headers: {
      "Content-Type": "application/json",
      "Authorization": token ? `Bearer ${token}` : "",
      ...(options.headers || {})
    }

  })

  return res.json()
}