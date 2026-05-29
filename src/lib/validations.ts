// Email validation
export const validateEmail = (email: string): { valid: boolean; error?: string } => {
  if (!email || email.trim() === "") {
    return { valid: false, error: "Email é obrigatório" };
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  if (!emailRegex.test(email)) {
    return { valid: false, error: "Email inválido. Use o formato: usuario@dominio.com" };
  }

  // Check for valid TLD (at least 2 letters after last dot)
  const parts = email.split("@");
  if (parts.length !== 2) {
    return { valid: false, error: "Email inválido" };
  }

  const domain = parts[1];
  const domainParts = domain.split(".");
  const tld = domainParts[domainParts.length - 1];
  
  if (!tld || tld.length < 2 || !/^[a-zA-Z]{2,}$/.test(tld)) {
    return { valid: false, error: "Domínio inválido. Verifique o TLD (ex: .com, .br)" };
  }

  return { valid: true };
};

// Phone validation for Brazilian format
export const validatePhone = (phone: string): { valid: boolean; error?: string } => {
  if (!phone || phone.trim() === "") {
    return { valid: false, error: "Telefone é obrigatório" };
  }

  // Remove all non-numeric characters
  const numbers = phone.replace(/\D/g, "");

  // Check length (10 or 11 digits for Brazilian phone)
  if (numbers.length < 10 || numbers.length > 11) {
    return { valid: false, error: "Telefone deve ter 10 ou 11 dígitos" };
  }

  // Check for invalid sequences
  const invalidSequences = [
    "0000000000", "00000000000",
    "1111111111", "11111111111",
    "2222222222", "22222222222",
    "3333333333", "33333333333",
    "4444444444", "44444444444",
    "5555555555", "55555555555",
    "6666666666", "66666666666",
    "7777777777", "77777777777",
    "8888888888", "88888888888",
    "9999999999", "99999999999",
  ];

  if (invalidSequences.includes(numbers)) {
    return { valid: false, error: "Telefone inválido" };
  }

  return { valid: true };
};

// Phone mask formatter
export const formatPhone = (value: string): string => {
  const numbers = value.replace(/\D/g, "");
  
  if (numbers.length <= 2) return `(${numbers}`;
  if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
};

// Name validation
export const validateName = (name: string): { valid: boolean; error?: string } => {
  if (!name || name.trim() === "") {
    return { valid: false, error: "Nome é obrigatório" };
  }

  const trimmedName = name.trim();

  // Minimum 3 characters
  if (trimmedName.length < 3) {
    return { valid: false, error: "Nome deve ter pelo menos 3 caracteres" };
  }

  // Maximum 100 characters
  if (trimmedName.length > 100) {
    return { valid: false, error: "Nome muito longo (máximo 100 caracteres)" };
  }

  // Check if it's only numbers
  if (/^\d+$/.test(trimmedName)) {
    return { valid: false, error: "Nome não pode conter apenas números" };
  }

  // Check if it's only special characters
  if (/^[^a-zA-ZÀ-ÿ]+$/.test(trimmedName)) {
    return { valid: false, error: "Nome deve conter letras" };
  }

  // Check for at least name and surname (at least 2 words)
  const words = trimmedName.split(/\s+/).filter(word => word.length > 0);
  if (words.length < 2) {
    return { valid: false, error: "Informe nome e sobrenome" };
  }

  return { valid: true };
};
