const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"
export async function api<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  })

  if (!res.ok) {
    throw new Error(await res.text())
  }

  return res.json()
}

export async function apiStream(
  path: string,
  options?: RequestInit
): Promise<Response> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  })

  if (!res.ok) {
    throw new Error(await res.text())
  }

  return res
}