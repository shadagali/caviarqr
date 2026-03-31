import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

export default function OrderStatusScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Order Confirmed 🎉</Text>
      <Text style={styles.text}>Your order has been placed successfully.</Text>

      <TouchableOpacity style={styles.button} onPress={() => router.replace("/")}>
        <Text style={styles.buttonText}>Back to Menu</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={() => router.push("/profile")}>
        <Text style={styles.buttonText}>View Profile</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#111", padding: 20 },
  title: { fontSize: 26, color: "#fff", marginBottom: 20 },
  text: { color: "#ccc", fontSize: 16, marginBottom: 30, textAlign: "center" },
  button: { backgroundColor: "#ff4d4d", padding: 15, borderRadius: 10, marginTop: 10, width: "80%", alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "bold" },
});