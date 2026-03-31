import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, FlatList } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { fetchStore } from "../../services/api";

export default function StoreScreen() {
  const { storeCode } = useLocalSearchParams<{ storeCode: string }>();

  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<any>(null);
  const [menu, setMenu] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        console.log("🟦 StoreScreen storeCode =", storeCode);

        if (!storeCode || typeof storeCode !== "string") {
          setError("Missing store code");
          setLoading(false);
          return;
        }

        const data = await fetchStore(storeCode);
        console.log("✅ Store response =", data);

        setBusiness(data.business);
        setMenu(data.menu || []);
      } catch (e: any) {
        console.log("❌ fetchStore error =", e?.message || e);
        setError("Failed to load store");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [storeCode]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 10 }}>Loading store...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text>{error}</Text>
        <Text style={{ marginTop: 10, color: "#666" }}>
          StoreCode: {String(storeCode)}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>
        {business?.name || "Store"}
      </Text>
      <Text style={{ color: "#666", marginBottom: 12 }}>
        Code: {business?.storeCode}
      </Text>

      {menu.length === 0 ? (
        <Text>No menu items yet.</Text>
      ) : (
        <FlatList
          data={menu}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View
              style={{
                padding: 12,
                borderWidth: 1,
                borderColor: "#ddd",
                borderRadius: 10,
                marginBottom: 10,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "600" }}>
                {item.name}
              </Text>
              <Text style={{ color: "#666" }}>{item.description}</Text>
              <Text style={{ marginTop: 6, fontWeight: "700" }}>
                ${Number(item.price).toFixed(2)}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}