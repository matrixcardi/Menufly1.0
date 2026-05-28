// Order bumps / Add-ons configuráveis por restaurante
export interface AddonItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
}

export interface AddonSection {
  id: string;
  title: string;
  description?: string;
  type: "single" | "multiple"; // single = radio, multiple = checkbox
  required: boolean;
  minSelect?: number;
  maxSelect?: number;
  items: AddonItem[];
}

// Configuração de add-ons por categoria de produto
// Em produção, isso viria do backend baseado no que o restaurante cadastrou
export const addonsByCategory: Record<string, AddonSection[]> = {
  smash: [
    {
      id: "turbine",
      title: "Turbine seu Hambúrguer",
      description: "Deixe seu lanche ainda mais saboroso",
      type: "multiple",
      required: false,
      maxSelect: 5,
      items: [
        { id: "bacon-extra", name: "Bacon Extra", description: "Porção extra de bacon crocante", price: 5.00 },
        { id: "cheddar-extra", name: "Cheddar Extra", description: "Mais cheddar cremoso", price: 4.00 },
        { id: "onion-rings", name: "Onion Rings", description: "Anéis de cebola empanados", price: 6.00 },
        { id: "egg", name: "Ovo", description: "Ovo frito", price: 3.00 },
        { id: "jalapeno", name: "Jalapeño", description: "Pimentas jalapeño em conserva", price: 2.50 },
      ],
    },
    {
      id: "bebida",
      title: "Deseja uma bebida para acompanhar?",
      type: "single",
      required: false,
      items: [
        { id: "coca-lata", name: "Coca-Cola Lata 350ml", price: 7.00 },
        { id: "guarana-lata", name: "Guaraná Lata 350ml", price: 6.00 },
        { id: "suco-laranja", name: "Suco de Laranja 300ml", price: 8.00 },
        { id: "agua", name: "Água Mineral 500ml", price: 4.00 },
      ],
    },
  ],
  classicos: [
    {
      id: "turbine",
      title: "Turbine seu Hambúrguer",
      type: "multiple",
      required: false,
      maxSelect: 5,
      items: [
        { id: "bacon-extra", name: "Bacon Extra", price: 5.00 },
        { id: "cheddar-extra", name: "Cheddar Extra", price: 4.00 },
        { id: "egg", name: "Ovo", price: 3.00 },
      ],
    },
    {
      id: "bebida",
      title: "Deseja uma bebida para acompanhar?",
      type: "single",
      required: false,
      items: [
        { id: "coca-lata", name: "Coca-Cola Lata 350ml", price: 7.00 },
        { id: "guarana-lata", name: "Guaraná Lata 350ml", price: 6.00 },
        { id: "agua", name: "Água Mineral 500ml", price: 4.00 },
      ],
    },
  ],
  combos: [
    {
      id: "upgrade",
      title: "Upgrade no Combo",
      type: "multiple",
      required: false,
      items: [
        { id: "batata-grande", name: "Batata Grande (+R$ 4)", price: 4.00 },
        { id: "refri-600", name: "Refrigerante 600ml (+R$ 3)", price: 3.00 },
      ],
    },
  ],
  acompanhamentos: [
    {
      id: "molhos",
      title: "Escolha seus molhos",
      type: "multiple",
      required: false,
      maxSelect: 3,
      items: [
        { id: "ketchup", name: "Ketchup Extra", price: 0 },
        { id: "maionese", name: "Maionese Extra", price: 0 },
        { id: "barbecue", name: "Molho Barbecue", price: 1.50 },
        { id: "cheddar-molho", name: "Molho Cheddar", price: 2.00 },
      ],
    },
  ],
  bebidas: [], // Bebidas geralmente não têm add-ons
};

export function getAddonsForProduct(category: string): AddonSection[] {
  return addonsByCategory[category] || [];
}
