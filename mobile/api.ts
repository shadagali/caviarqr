import { Platform } from "react-native";

/**
 * CHANGE THIS to your PC IP
 * From ipconfig → Wi-Fi IPv4
 */
const LAN_IP = "172.20.10.2";

export const BASE_URL =
  Platform.OS === "android"
    ? `http://${LAN_IP}:3000`
    : `http://${LAN_IP}:3000`;

/* ============================
   STORE
============================ */
export async function fetchStore(storeCode: string) {
  const res = await fetch(`${BASE_URL}/store/${storeCode}`);
  if (!res.ok) throw new Error("Store not found");
  return res.json();
}

/* ============================
   AUTH
============================ */
export async function register(email: string, password: string) {
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function login(email: string, password: string) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/* ============================
   PAYMENT
============================ */
export async function createPaymentIntent(data: {
  amount: number;
  customerId: string;
  businessId: string;
  items: any[];
}) {
  const res = await fetch(`${BASE_URL}/stripe/payment-intent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}