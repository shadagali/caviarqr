import { io } from "socket.io-client";
import { Platform } from "react-native";

const LAN_IP = "192.168.29.147"; // ← your WiFi IPv4

function getSocketUrl() {
  if (__DEV__) {
    if (Platform.OS === "android") {
      return "http://10.0.2.2:3000";
    }

    return "http://localhost:3000";
  }

  return `http://${LAN_IP}:3000`;
}

const SOCKET_URL = getSocketUrl();

export const socket = io(SOCKET_URL, {
  transports: ["websocket"],
  autoConnect: true,
});