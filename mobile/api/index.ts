import axios from "axios";

const API = "http://localhost:3001";

export const createPaymentIntent = async (data: any) => {
  const res = await axios.post(`${API}/stripe/payment-intent`, data);
  return res.data;
};

export const createOrder = async (data: any) => {
  const res = await axios.post(`${API}/order`, data);
  return res.data;
};