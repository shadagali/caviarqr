import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';

const BACKEND = 'http://192.168.1.39:3000'; 
// ⚠️ make sure this is YOUR IP from ipconfig

export default function KitchenScreen() {
  const [orders, setOrders] = useState<any[]>([]);

  const loadOrders = async () => {
    try {
      const res = await fetch(`${BACKEND}/orders`);
      const data = await res.json();
      setOrders(data.reverse());
    } catch (e) {
      console.log('Failed to load orders');
    }
  };

  const markReady = async (id: string) => {
    await fetch(`${BACKEND}/admin/orders/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'READY' }),
    });

    loadOrders();
  };

  useEffect(() => {
    loadOrders();

    const interval = setInterval(() => {
      loadOrders();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🍳 Kitchen Dashboard</Text>

      {orders.map((order) => (
        <View
          key={order.id}
          style={[
            styles.card,
            order.status === 'READY'
              ? styles.ready
              : styles.received,
          ]}
        >
          <Text style={styles.orderId}>
            Order #{order.id.slice(0, 6)}
          </Text>

          <Text style={styles.status}>
            Status: {order.status}
          </Text>

          {order.items.map((item: any, i: number) => (
            <Text key={i} style={styles.item}>
              • {item.name}
            </Text>
          ))}

          {order.status !== 'READY' && (
            <Pressable
              style={styles.button}
              onPress={() => markReady(order.id)}
            >
              <Text style={styles.buttonText}>
                Mark as READY
              </Text>
            </Pressable>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#111',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 20,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  received: {
    backgroundColor: '#3b1f1f',
  },
  ready: {
    backgroundColor: '#1f3b1f',
  },
  orderId: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  status: {
    color: '#ccc',
    marginBottom: 8,
  },
  item: {
    color: 'white',
    fontSize: 16,
  },
  button: {
    marginTop: 12,
    backgroundColor: '#ff9800',
    padding: 10,
    borderRadius: 8,
  },
  buttonText: {
    textAlign: 'center',
    color: 'black',
    fontWeight: 'bold',
  },
});
