import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

export default function ProfileScreen() {
  const { user, logout } = useContext(AuthContext);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Profile</Text>

      <Text style={styles.text}>Email: {user?.email}</Text>
      <Text style={styles.text}>Customer ID: {user?.stripeCustomerId}</Text>

      <TouchableOpacity style={styles.button} onPress={logout}>
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>

      <Text style={styles.section}>Past Orders</Text>
      <Text style={styles.text}>No orders yet.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#111" },
  title: { fontSize: 24, color: "#fff", marginBottom: 20 },
  text: { color: "#ccc", marginBottom: 10 },
  button: { backgroundColor: "#ff4d4d", padding: 15, borderRadius: 10, alignItems: "center", marginTop: 20 },
  buttonText: { color: "#fff", fontWeight: "bold" },
  section: { marginTop: 30, fontSize: 18, color: "#fff" },
});