export type NavSection =
  | 'dashboard'
  | 'sales'
  | 'expenses'
  | 'inventory'
  | 'assistant'
  | 'settings';

export type PaymentStatus = 'Paid' | 'Pending' | 'Partial';

export type PaymentMethod = 'Bank Transfer' | 'POS Terminal' | 'Cash' | 'Mobile Money';

export type SalesRange = '7d' | '30d' | '6m';

export type ExpenseCategory =
  | 'Inventory Restock'
  | 'Logistics & Delivery'
  | 'Power & Generator Fuel'
  | 'Rent & Utilities'
  | 'Staff Salaries'
  | 'Marketing & Ads'
  | 'Packaging & Supplies';

export type ProductCategory =
  | 'Grains & Staples'
  | 'Cooking Oils'
  | 'Beverages & Dairy'
  | 'Packaged Foods'
  | 'Household Essentials';

export interface Product {
  id: string; // Firestore productId
  userId: string;
  sku: string;
  name: string; // Firestore productName
  category: ProductCategory;
  unit: string;
  costPrice: number;
  unitPrice: number; // Firestore sellingPrice
  stock: number; // Firestore quantity
  reorderLevel: number; // Firestore lowStockThreshold
  updatedAt: string;
}

export interface SaleOrder {
  id: string; // Firestore saleId
  orderNumber: string;
  userId: string;
  date: string; // YYYY-MM-DD
  productId: string | null;
  productName: string; // Firestore product
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  amountPaid: number;
  customerName: string; // Firestore customer
  customerPhone: string;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  notes?: string;
  createdAtMs?: number;
}

export interface Expense {
  id: string; // Firestore expenseId
  userId: string;
  date: string; // YYYY-MM-DD
  category: ExpenseCategory;
  description: string;
  vendor: string;
  amount: number;
  paymentMethod: PaymentMethod;
  createdAtMs?: number;
}

export interface BusinessSettings {
  userId: string;
  businessName: string;
  ownerName: string;
  businessType: string;
  rcNumber: string;
  address: string;
  phone: string;
  email: string;
  currencyCode: 'NGN';
  currencySymbol: '₦';
  defaultReorderLevel: number;
  vatEnabled: boolean;
  vatRate: number;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isError?: boolean;
}

export interface BusinessState {
  products: Product[];
  sales: SaleOrder[];
  expenses: Expense[];
  settings: BusinessSettings;
}
