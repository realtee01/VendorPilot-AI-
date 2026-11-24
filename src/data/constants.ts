import { ExpenseCategory, PaymentMethod, ProductCategory } from '../types/business';

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  'Grains & Staples',
  'Cooking Oils',
  'Beverages & Dairy',
  'Packaged Foods',
  'Household Essentials',
];

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Inventory Restock',
  'Logistics & Delivery',
  'Power & Generator Fuel',
  'Rent & Utilities',
  'Staff Salaries',
  'Marketing & Ads',
  'Packaging & Supplies',
];

export const PAYMENT_METHODS: PaymentMethod[] = [
  'Bank Transfer',
  'POS Terminal',
  'Cash',
  'Mobile Money',
];

export const BUSINESS_TYPE_SUGGESTIONS: string[] = [
  'FMCG Wholesale & Provision Store',
  'Supermarket & Retail Mart',
  'Food, Bakery & Catering',
  'Electronics & Mobile Accessories',
  'Fashion, Fabrics & Apparel',
  'Pharmacy & Healthcare Supplies',
  'Agro-Allied & Produce Trading',
  'Building Materials & Hardware',
];

export function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}
