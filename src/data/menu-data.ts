import burger1 from "@/assets/burger-1.jpg";
import burger2 from "@/assets/burger-2.jpg";
import burger3 from "@/assets/burger-3.jpg";
import fries from "@/assets/fries.jpg";
import soda from "@/assets/soda.jpg";
import combo from "@/assets/combo.jpg";

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  cashback?: number;
  isPopular?: boolean;
}

export interface Category {
  id: string;
  name: string;
}

export const categories: Category[] = [
  { id: "smash", name: "Smash Burgers" },
  { id: "classicos", name: "Clássicos" },
  { id: "combos", name: "Combos" },
  { id: "acompanhamentos", name: "Acompanhamentos" },
  { id: "bebidas", name: "Bebidas" },
];

export const products: Product[] = [
  {
    id: "1",
    name: "Smash Bacon Duplo",
    description: "Pão brioche, 2 carnes smash 80g, queijo cheddar, bacon crocante e molho especial da casa",
    price: 38.90,
    image: burger1,
    category: "smash",
    cashback: 5,
    isPopular: true,
  },
  {
    id: "2",
    name: "Classic Burger",
    description: "Pão com gergelim, carne 150g, queijo, alface, tomate, bacon e maionese",
    price: 34.90,
    image: burger2,
    category: "classicos",
    isPopular: true,
  },
  {
    id: "3",
    name: "Double Cheese",
    description: "Pão brioche, 2 carnes 100g, queijo cheddar duplo, picles e cebola",
    price: 42.90,
    image: burger3,
    category: "classicos",
    cashback: 5,
  },
  {
    id: "4",
    name: "Batata Frita Grande",
    description: "Porção generosa de batatas fritas crocantes com ketchup",
    price: 18.90,
    image: fries,
    category: "acompanhamentos",
    isPopular: true,
  },
  {
    id: "5",
    name: "Coca-Cola Lata 350ml",
    description: "Refrigerante Coca-Cola gelado",
    price: 7.00,
    image: soda,
    category: "bebidas",
    isPopular: true,
  },
  {
    id: "6",
    name: "Combo Smash Completo",
    description: "Smash Burger + Batata Média + Refrigerante 350ml",
    price: 49.90,
    image: combo,
    category: "combos",
    cashback: 10,
    isPopular: true,
  },
  {
    id: "7",
    name: "Smash Simples",
    description: "Pão brioche, carne smash 80g, queijo cheddar e molho especial",
    price: 28.90,
    image: burger1,
    category: "smash",
  },
  {
    id: "8",
    name: "Smash Cheddar Bacon",
    description: "Pão brioche, carne smash 80g, cheddar cremoso, bacon e cebola caramelizada",
    price: 35.90,
    image: burger3,
    category: "smash",
    cashback: 5,
  },
];

export const restaurantInfo = {
  name: "Burger House",
  isOpen: false,
  opensAt: "18:30",
  closesAt: "23:00",
  minOrder: 30.00,
  rating: 5.0,
  deliveryAvailable: true,
  pickupAvailable: true,
};
