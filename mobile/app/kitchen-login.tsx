import { useState } from "react"
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native"
import { useRouter } from "expo-router"

export default function KitchenLogin() {
  const [storeCode, setStoreCode] = useState("")
  const router = useRouter()

  const login = async () => {
    if (!storeCode) {
      alert("Enter store code")
      return
    }

    router.replace(`/kitchen-panel?storeCode=${storeCode}`)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kitchen Login</Text>

      <TextInput
        placeholder="Store Code (e.g. cafe1)"
        style={styles.input}
        onChangeText={setStoreCode}
      />

      <TouchableOpacity style={styles.button} onPress={login}>
        <Text style={styles.buttonText}>Enter Kitchen</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  input: {
    borderWidth: 1,
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#000",
    padding: 18,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 18 },
})