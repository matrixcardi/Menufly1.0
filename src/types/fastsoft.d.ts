/**
 * SDK de tokenização da HyperCash, carregado de https://js.hypercash.com.br/security.js
 * (o global exposto continua sendo `FastSoft`, herança do host antigo
 * js.fastsoftbrasil.com/security.js, que a doc ainda cita)
 * Doc: https://docs.hypercash.com.br/docs/intro/card-tokenization
 *      https://docs.hypercash.com.br/docs/intro/3ds-authentication
 *
 * O SDK é injetado em runtime e não publica tipos, então o contrato vive aqui.
 */

export interface FastSoftCardData {
  number: string;
  holderName: string;
  expMonth: string;
  expYear: string;
  cvv: string;
}

export interface FastSoftThreeDSInit {
  amount: number;
  currency: "BRL" | "USD" | "EUR";
  installments: number;
  card: FastSoftCardData;
}

export interface FastSoftThreeDSAuth {
  customer: {
    name: string;
    email: string;
    phoneNumber: string;
  };
  address: {
    street: string;
    streetNumber: string;
    complement?: string;
    zipCode: string;
    neighborhood: string;
    city: string;
    state: string;
    country: string;
  };
}

export interface FastSoftSDK {
  setPublicKey(key: string): void;
  /** Tokeniza o cartão no browser. O token expira em 15 minutos. */
  encrypt(card: FastSoftCardData): Promise<string>;
  isThreeDSEnabled?(): boolean;
  initializeThreeDS?(params: FastSoftThreeDSInit): Promise<void>;
  authenticateThreeDS?(params: FastSoftThreeDSAuth): Promise<unknown>;
  finalizeThreeDS?(): Promise<void>;
}

declare global {
  interface Window {
    FastSoft?: FastSoftSDK;
  }
}
