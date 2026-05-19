export type Language = "en" | "ha";
export type LocalizedString = Record<Language, string>;

export interface Product {
  id: string;
  name: LocalizedString;
  category: LocalizedString;
  subcategory: LocalizedString;
  price: string;
  vendor: string;
  area: string;
  availability: LocalizedString;
  accent: string;
  tags: string[];
}

export interface SearchRecord {
  id: string;
  query: string;
  language: Language;
  resultCount: number;
  category: string;
  status: "matched" | "saved demand";
  createdAt: string;
}

export interface VendorRequest {
  id: string;
  businessName: string;
  phone: string;
  area: string;
  category: string;
  createdAt: string;
}

export interface AppState {
  language: Language;
  cartCount: number;
  lastQuery: string;
  lastResults: Product[];
}

export interface DemoOrder {
  id: string;
  item: LocalizedString;
  status: LocalizedString;
}

export interface DemoPayment {
  label: LocalizedString;
  value: LocalizedString;
}

export interface RecordRow {
  label: string;
  value: LocalizedString | string;
}
