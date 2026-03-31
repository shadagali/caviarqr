import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const LAN_IP = "192.168.29.147"; // keep yours here

function getBaseUrl() {
  return `http://${LAN_IP}:3000`;
}

const api = axios.create({
  baseURL: getBaseUrl(),
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

/**
 * ===============================
 * AUTH
 * ===============================
 */

export async function register(email: string, password: string) {
  const res = await api.post("/auth/register", { email, password });
  return res.data;
}

export async function login(email: string, password: string) {
  const res = await api.post("/auth/login", { email, password });
  return res.data;
}

export async function getMe() {
  const res = await api.get("/auth/me");
  return res.data;
}

/**
 * ===============================
 * STORE
 * ===============================
 */

export async function fetchStore(storeCode: string) {
  const res = await api.get(`/store/${storeCode}`);
  return res.data;
}

/**
 * ===============================
 * STRIPE PAYMENT SHEET
 * ===============================
 */

export async function createPaymentSheet(data: {
  businessId: string;
  items: any[];
  totalAmount: number;
}) {
  const res = await api.post("/stripe/payment-sheet", data);
  return res.data;
}

/**
 * ===============================
 * ORDERS
 * ===============================
 */

export async function getMyOrders(page = 1) {
  const res = await api.get(`/order/my?page=${page}`);
  return res.data;
}

export async function getBusinessOrders(page = 1) {
  const res = await api.get(`/order/business?page=${page}`);
  return res.data;
}

export default api;