export const API_URL = "http://192.168.1.34:3001";

export async function apiFetch(path: string) {
  try {
    const res = await fetch(`${API_URL}${path}`);

    if (!res.ok) {
      throw new Error("Network response not ok");
    }

    return await res.json();
  } catch (err) {
    console.log("API ERROR:", err);
    throw err;
  }
}