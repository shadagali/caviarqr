export async function apiFetch(url: string, options: RequestInit) {
  try {
    const res = await fetch(url, options)

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      return {
        success: false,
        message: data.message || "Request failed",
      }
    }

    return {
      success: true,
      ...data,
    }
  } catch (err: any) {
    console.log("API ERROR:", err)

    return {
      success: false,
      message: "Network error",
    }
  }
}