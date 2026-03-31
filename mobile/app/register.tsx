import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useContext, useState } from "react";
import { useRouter } from "expo-router";
import { AuthContext } from "../context/AuthContext";

export default function RegisterScreen() {
  const { register } = useContext(AuthContext);
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async () => {
    try {
      await register(email, password);
      router.replace("/profile"); // 👈 Go to profile after signup
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>

      <TextInput
        placeholder="Email"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        placeholder="Password"
        style={styles.input}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.button} onPress={handleRegister}>
        <Text style={styles.buttonText}>Sign Up</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: "#111" },
  title: { fontSize: 24, color: "#fff", marginBottom: 20, textAlign: "center" },
  input: { backgroundColor: "#222", color: "#fff", padding: 15, borderRadius: 10, marginBottom: 10 },
  button: { backgroundColor: "#ff4d4d", padding: 15, borderRadius: 10, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "bold" },
});