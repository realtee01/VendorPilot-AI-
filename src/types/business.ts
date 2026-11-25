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

export type DashboardPeriod = 'daily' | 'weekly' | 'monthly' | 'all';

export type CurrencyCode = 'NGN' | 'USD' | 'GBP' | 'GHS';
export type CurrencySymbol = '₦' | '$' | '£' | '₵';

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
  id: string; // Firestore productId in /products/{productId}
  userId: string;
  businessId?: string;
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

export interface Customer {
  id: string; // Firestore customerId in /customers/{customerId}
  userId: string;
  businessId: string;
  name: string;
  phone: string;
  email: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: string;
}

export interface SaleOrder {
  id: string; // Firestore saleId in /sales/{saleId}
  orderNumber: string;
  userId: string;
  businessId?: string;
  date: string; // YYYY-MM-DD
  productId: string | null;
  productName: string; // Firestore product
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  amountPaid: number;
  customerId?: string | null;
  customerName: string; // Firestore customer
  customerPhone: string;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  notes?: string;
  stockDeductedQty?: number;
  createdAtMs?: number;
}

export interface Expense {
  id: string; // Firestore expenseId in /expenses/{expenseId}
  userId: string;
  businessId?: string;
  date: string; // YYYY-MM-DD
  category: ExpenseCategory;
  description: string;
  vendor: string;
  amount: number;
  paymentMethod: PaymentMethod;
  createdAtMs?: number;
}

export type OnboardingUsageType = 'business' | 'personal';
export type OnboardingExperienceLevel = 'experienced' | 'spreadsheet' | 'beginner';
export type OnboardingPrimaryGoal = 'sales' | 'inventory' | 'expenses' | 'assistant';

export interface BusinessSettings {
  userId: string;
  businessId?: string;
  businessName: string;
  ownerName: string;
  businessType: string; // Business category
  rcNumber: string;
  address: string; // Business location
  phone: string;
  email: string;
  currencyCode: CurrencyCode;
  currencySymbol: CurrencySymbol;
  defaultReorderLevel: number;
  vatEnabled: boolean;
  vatRate: number;
  usageType?: OnboardingUsageType;
  experienceLevel?: OnboardingExperienceLevel;
  primaryGoal?: OnboardingPrimaryGoal;
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
  customers: Customer[];
  settings: BusinessSettings;
}
