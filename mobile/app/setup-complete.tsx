import { View, Text } from "react-native"

export default function SetupComplete() {

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >

      <Text
        style={{
          fontSize: 28,
          fontWeight: "bold",
          marginBottom: 20,
        }}
      >
        Setup Complete 🎉
      </Text>

      <Text
        style={{
          fontSize: 16,
          textAlign: "center",
          color: "#666",
        }}
      >
        Your restaurant is ready to accept orders.
      </Text>

    </View>
  )
}