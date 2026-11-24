import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  BusinessSettings,
  Expense,
  ExpenseCategory,
  PaymentMethod,
  PaymentStatus,
  Product,
  ProductCategory,
  SaleOrder,
} from '../types/business';

interface FirebaseAppletConfig {
  projectId: string;
  apiKey: string;
  firestoreDatabaseId?: string;
}

export interface VerifiedFirebaseUser {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
}

export interface FirestoreValue {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  timestampValue?: string;
  nullValue?: null;
  mapValue?: { fields?: Record<string, FirestoreValue> };
  arrayValue?: { values?: FirestoreValue[] };
}

interface FirestoreDocument {
  name: string;
  fields?: Record<string, FirestoreValue>;
  createTime?: string;
  updateTime?: string;
}

export interface UserBusinessRecords {
  profileFound: boolean;
  settings: Partial<BusinessSettings>;
  sales: SaleOrder[];
  expenses: Expense[];
  products: Product[];
}

const VALID_UID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

let cachedConfig: FirebaseAppletConfig | null = null;

function loadFirebaseConfig(): FirebaseAppletConfig {
  if (cachedConfig) return cachedConfig;
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const candidatePaths = [
    path.resolve(__dirname, '../../firebase-applet-config.json'),
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
  ];

  const existingPath = candidatePaths.find((candidate) => fs.existsSync(candidate));
  if (!existingPath) {
    throw new Error('Firebase configuration file (firebase-applet-config.json) was not found.');
  }

  const raw = fs.readFileSync(existingPath, 'utf8');
  const parsed = JSON.parse(raw) as FirebaseAppletConfig;
  if (!parsed.projectId || !parsed.apiKey) {
    throw new Error('Firebase configuration is missing projectId or apiKey.');
  }
  cachedConfig = parsed;
  return parsed;
}

export function decodeFirestoreValue(value: FirestoreValue | undefined): unknown {
  if (!value) return undefined;
  if ('stringValue' in value && value.stringValue !== undefined) return value.stringValue;
  if ('integerValue' in value && value.integerValue !== undefined) return Number(value.integerValue);
  if ('doubleValue' in value && value.doubleValue !== undefined) return Number(value.doubleValue);
  if ('booleanValue' in value && value.booleanValue !== undefined) return Boolean(value.booleanValue);
  if ('timestampValue' in value && value.timestampValue !== undefined) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) {
    return (value.arrayValue?.values ?? []).map((item) => decodeFirestoreValue(item));
  }
  if ('mapValue' in value) {
    return decodeFirestoreFields(value.mapValue?.fields);
  }
  return undefined;
}

export function decodeFirestoreFields(
  fields: Record<string, FirestoreValue> | undefined
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (!fields) return result;
  for (const [key, val] of Object.entries(fields)) {
    result[key] = decodeFirestoreValue(val);
  }
  return result;
}

function extractDocId(documentName: string): string {
  const idx = documentName.lastIndexOf('/');
  return idx >= 0 ? documentName.slice(idx + 1) : documentName;
}

function isoDatePrefix(value: unknown): string {
  if (typeof value === 'string' && value.length >= 10) {
    return value.slice(0, 10);
  }
  return '';
}

function isoTimestampToMs(value: unknown): number {
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export class AuthVerificationError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = 'AuthVerificationError';
    this.status = status;
  }
}

export class FirestoreAccessError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = 'FirestoreAccessError';
    this.status = status;
  }
}

/**
 * Verifies a Firebase ID token against Google Firebase Auth's Identity Toolkit
 * accounts:lookup endpoint without requiring service account credentials.
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseUser> {
  const trimmed = idToken.trim();
  if (!trimmed || trimmed.length > 8192) {
    throw new AuthVerificationError('Authentication token is missing or invalid.', 401);
  }

  const config = loadFirebaseConfig();
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(config.apiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: trimmed }),
  });

  if (!res.ok) {
    throw new AuthVerificationError('Your sign-in session has expired or is invalid. Please sign in again.', 401);
  }

  const data = (await res.json()) as {
    users?: Array<{
      localId?: string;
      email?: string;
      displayName?: string;
      emailVerified?: boolean;
    }>;
  };

  const account = data.users?.[0];
  if (!account?.localId || !VALID_UID_REGEX.test(account.localId)) {
    throw new AuthVerificationError('Unable to verify authenticated user identity.', 401);
  }

  return {
    uid: account.localId,
    email: account.email ?? '',
    displayName: account.displayName ?? '',
    emailVerified: Boolean(account.emailVerified),
  };
}

async function runTenantCollectionQuery(
  collectionId: 'sales' | 'expenses' | 'products' | 'customers',
  uid: string,
  idToken: string,
  baseDocumentsUrl: string
): Promise<FirestoreDocument[]> {
  const res = await fetch(`${baseDocumentsUrl}:runQuery`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'userId' },
            op: 'EQUAL',
            value: { stringValue: uid },
          },
        },
        limit: 500,
      },
    }),
  });

  if (res.status === 401 || res.status === 403) {
    throw new FirestoreAccessError(
      `Permission denied reading ${collectionId} records for this account.`,
      403
    );
  }

  if (!res.ok) {
    throw new FirestoreAccessError(`Failed to load ${collectionId} records from Firestore.`, 502);
  }

  const rows = (await res.json()) as Array<{ document?: FirestoreDocument }>;
  return rows.map((row) => row.document).filter((doc): doc is FirestoreDocument => Boolean(doc));
}

/**
 * Loads the authenticated user's profile, business profile, sales, expenses, and products
 * directly from Cloud Firestore using the user's own Firebase ID token so Firestore Security
 * Rules enforce per-user data isolation on every server-side read.
 */
export async function fetchUserBusinessRecordsFromFirestore(
  user: VerifiedFirebaseUser,
  idToken: string
): Promise<UserBusinessRecords> {
  if (!VALID_UID_REGEX.test(user.uid)) {
    throw new AuthVerificationError('Invalid user identifier.', 401);
  }

  const config = loadFirebaseConfig();
  const databaseId = config.firestoreDatabaseId || '(default)';
  const baseDocumentsUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/databases/${encodeURIComponent(databaseId)}/documents`;

  const [profileRes, businessRes, salesDocs, expenseDocs, productDocs] = await Promise.all([
    fetch(`${baseDocumentsUrl}/users/${encodeURIComponent(user.uid)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${idToken}` },
    }),
    fetch(`${baseDocumentsUrl}/businesses/${encodeURIComponent(user.uid)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${idToken}` },
    }),
    runTenantCollectionQuery('sales', user.uid, idToken, baseDocumentsUrl),
    runTenantCollectionQuery('expenses', user.uid, idToken, baseDocumentsUrl),
    runTenantCollectionQuery('products', user.uid, idToken, baseDocumentsUrl),
  ]);

  let profileFound = false;
  let settings: Partial<BusinessSettings> = {
    userId: user.uid,
    businessId: user.uid,
    ownerName: user.displayName || 'Business Owner',
    email: user.email,
    businessName: 'Your Business',
    businessType: 'SME',
    currencyCode: 'NGN',
    currencySymbol: '₦',
  };

  if (profileRes.ok) {
    const profileDoc = (await profileRes.json()) as FirestoreDocument;
    const data = decodeFirestoreFields(profileDoc.fields);
    profileFound = true;
    settings = {
      ...settings,
      userId: String(data.userId ?? user.uid),
      businessId: String(data.businessId ?? user.uid),
      ownerName: String(data.name ?? user.displayName ?? 'Business Owner'),
      email: String(data.email ?? user.email ?? ''),
      businessName: String(data.businessName ?? 'Your Business'),
      businessType: String(data.businessType ?? 'SME'),
      rcNumber: String(data.rcNumber ?? ''),
      address: String(data.address ?? ''),
      phone: String(data.phone ?? ''),
      currencyCode: (data.currencyCode as BusinessSettings['currencyCode']) || 'NGN',
      currencySymbol: (data.currencySymbol as BusinessSettings['currencySymbol']) || '₦',
      defaultReorderLevel: Number(data.defaultReorderLevel ?? 10),
      vatEnabled: Boolean(data.vatEnabled ?? true),
      vatRate: Number(data.vatRate ?? 7.5),
      createdAt: isoDatePrefix(data.createdAt),
    };
  } else if (profileRes.status !== 404) {
    throw new FirestoreAccessError('Unable to read your user profile from Firestore.', 502);
  }

  if (businessRes.ok) {
    const bizDoc = (await businessRes.json()) as FirestoreDocument;
    const biz = decodeFirestoreFields(bizDoc.fields);
    profileFound = true;
    settings = {
      ...settings,
      businessId: String(biz.businessId ?? user.uid),
      businessName: String(biz.businessName ?? settings.businessName ?? 'Your Business'),
      businessType: String(biz.businessCategory ?? settings.businessType ?? 'SME'),
      address: String(biz.location ?? settings.address ?? ''),
      phone: String(biz.phone ?? settings.phone ?? ''),
      currencyCode: (biz.currencyCode as BusinessSettings['currencyCode']) || settings.currencyCode || 'NGN',
      currencySymbol: (biz.currencySymbol as BusinessSettings['currencySymbol']) || settings.currencySymbol || '₦',
      rcNumber: String(biz.rcNumber ?? settings.rcNumber ?? ''),
      defaultReorderLevel: Number(biz.defaultReorderLevel ?? settings.defaultReorderLevel ?? 10),
      vatEnabled: Boolean(biz.vatEnabled ?? settings.vatEnabled ?? true),
      vatRate: Number(biz.vatRate ?? settings.vatRate ?? 7.5),
    };
  } else if (businessRes.status !== 404) {
    throw new FirestoreAccessError('Unable to read your business profile from Firestore.', 502);
  }

  const products: Product[] = productDocs
    .map((doc) => {
      const data = decodeFirestoreFields(doc.fields);
      const id = extractDocId(doc.name);
      return {
        id,
        userId: String(data.userId ?? user.uid),
        businessId: String(data.businessId ?? user.uid),
        sku: String(data.sku ?? ''),
        name: String(data.productName ?? ''),
        category: String(data.category ?? 'Packaged Foods') as ProductCategory,
        unit: String(data.unit ?? 'Unit'),
        costPrice: Number(data.costPrice ?? 0),
        unitPrice: Number(data.sellingPrice ?? 0),
        stock: Number(data.quantity ?? 0),
        reorderLevel: Number(data.lowStockThreshold ?? 10),
        updatedAt: isoDatePrefix(data.updatedAt),
      };
    })
    .filter((p) => p.userId === user.uid);

  const sales: SaleOrder[] = salesDocs
    .map((doc) => {
      const data = decodeFirestoreFields(doc.fields);
      const id = extractDocId(doc.name);
      return {
        id,
        orderNumber: String(data.orderNumber ?? id.slice(0, 8).toUpperCase()),
        userId: String(data.userId ?? user.uid),
        date: String(data.date ?? ''),
        productId: data.productId ? String(data.productId) : null,
        productName: String(data.product ?? ''),
        quantity: Number(data.quantity ?? 0),
        unitPrice: Number(data.unitPrice ?? 0),
        totalAmount: Number(data.totalAmount ?? 0),
        amountPaid: Number(data.amountPaid ?? 0),
        customerName: String(data.customer ?? ''),
        customerPhone: String(data.customerPhone ?? ''),
        paymentStatus: String(data.paymentStatus ?? 'Pending') as PaymentStatus,
        paymentMethod: String(data.paymentMethod ?? 'Bank Transfer') as PaymentMethod,
        notes: data.notes ? String(data.notes) : undefined,
        createdAtMs: isoTimestampToMs(data.createdAt),
      };
    })
    .filter((s) => s.userId === user.uid)
    .sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0);
    });

  const expenses: Expense[] = expenseDocs
    .map((doc) => {
      const data = decodeFirestoreFields(doc.fields);
      const id = extractDocId(doc.name);
      return {
        id,
        userId: String(data.userId ?? user.uid),
        date: String(data.date ?? ''),
        category: String(data.category ?? 'Inventory Restock') as ExpenseCategory,
        description: String(data.description ?? ''),
        vendor: String(data.vendor ?? ''),
        amount: Number(data.amount ?? 0),
        paymentMethod: String(data.paymentMethod ?? 'Bank Transfer') as PaymentMethod,
        createdAtMs: isoTimestampToMs(data.createdAt),
      };
    })
    .filter((e) => e.userId === user.uid)
    .sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0);
    });

  return {
    profileFound,
    settings,
    sales,
    expenses,
    products,
  };
}
