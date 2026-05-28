import { Coupon } from "@/contexts/CartContext";

// Cupom fixo de primeira compra - sempre disponível
export const firstPurchaseCoupon: Coupon = {
  code: "BEMVINDO5",
  discount: 5,
  type: "percentage",
  description: "5% OFF na sua primeira compra",
};

// Cupons promocionais regulares
export const availableCoupons: Coupon[] = [
  {
    code: "PRIMEIRACOMPRA",
    discount: 15,
    type: "percentage",
    description: "15% OFF na primeira compra",
  },
  {
    code: "FRETE10",
    discount: 10,
    type: "fixed",
    description: "R$ 10 OFF no seu pedido",
  },
  {
    code: "SMASH20",
    discount: 20,
    type: "percentage",
    description: "20% OFF em Smash Burgers",
  },
  {
    code: "COMBO5",
    discount: 5,
    type: "fixed",
    description: "R$ 5 OFF em combos",
  },
];
