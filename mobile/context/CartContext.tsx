import { createContext, useContext, useState } from "react";

export const CartContext = createContext<any>(null);

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }: any) => {

  const [cart, setCart] = useState<any[]>([]);

  const addItem = (item: any) => {
    setCart((prev) => [...prev, item]);
  };

  const removeItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCart([]);
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addItem,
        removeItem,
        clearCart,
        total,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};