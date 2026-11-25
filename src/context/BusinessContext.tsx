import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  BusinessSettings,
  BusinessState,
  CurrencyCode,
  CurrencySymbol,
  Customer,
  Expense,
  ExpenseCategory,
  PaymentMethod,
  PaymentStatus,
  Product,
  ProductCategory,
  SaleOrder,
} from '../types/business';
import {
  auth,
  BLUEPRINT_LIMITS,
  db,
  generateDocumentId,
  handleFirestoreError,
  OperationType,
  sanitizeText,
} from '../firebase';
import { getCurrencySymbol } from '../data/constants';
import {
  calculateDashboardMetrics,
  computeSaleStockDelta,
  DashboardMetrics,
  generateNextOrderNumber,
  ExpenseCategorySummary,
  getExpenseByCategory,
  getLowStockProducts,
  getTopSellingProducts,
  TopProductItem,
} from '../utils/analytics';

interface CreateProfilePayload {
  name: string;
  businessName: string;
  businessType: string;
  address: string;
  phone: string;
  currencyCode: CurrencyCode;
}

export interface SaleFormPayload {
  draftSaleId?: string;
  productId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  customerName: string;
  customerPhone: string;
  paymentStatus: PaymentStatus;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  date: string;
  notes?: string;
}

export interface ExpenseFormPayload {
  date: string;
  category: ExpenseCategory;
  description: string;
  vendor: string;
  amount: number;
  paymentMethod: PaymentMethod;
}

export interface ProductFormPayload {
  sku: string;
  name: string;
  category: ProductCategory;
  unit: string;
  costPrice: number;
  unitPrice: number;
  stock: number;
  reorderLevel: number;
}

interface BusinessContextValue {
  user: User | null;
  authReady: boolean;
  emailVerified: boolean;
  profileLoading: boolean;
  profileExists: boolean;
  dataLoading: boolean;
  state: BusinessState;
  metrics: DashboardMetrics;
  lowStockProducts: Product[];
  topSellingProducts: TopProductItem[];
  expenseByCategory: ExpenseCategorySummary[];
  refreshAuthUser: () => Promise<boolean>;
  createBusinessProfile: (payload: CreateProfilePayload) => Promise<void>;
  signOutUser: () => Promise<void>;
  recordSale: (payload: SaleFormPayload) => Promise<SaleOrder>;
  updateSale: (saleId: string, payload: SaleFormPayload) => Promise<void>;
  markOrderPaid: (orderId: string) => Promise<void>;
  deleteSale: (orderId: string) => Promise<void>;
  recordExpense: (payload: ExpenseFormPayload) => Promise<Expense>;
  updateExpense: (expenseId: string, payload: ExpenseFormPayload) => Promise<void>;
  deleteExpense: (expenseId: string) => Promise<void>;
  addProduct: (payload: ProductFormPayload) => Promise<Product>;
  updateProduct: (productId: string, payload: ProductFormPayload) => Promise<void>;
  restockProduct: (productId: string, addedQuantity: number) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  updateSettings: (settings: BusinessSettings) => Promise<void>;
}

const EMPTY_SETTINGS: BusinessSettings = {
  userId: '',
  businessId: '',
  businessName: '',
  ownerName: '',
  businessType: '',
  rcNumber: '',
  address: '',
  phone: '',
  email: '',
  currencyCode: 'NGN',
  currencySymbol: '₦',
  defaultReorderLevel: 10,
  vatEnabled: true,
  vatRate: 7.5,
  createdAt: '',
};

const BusinessContext = createContext<BusinessContextValue | null>(null);

function timestampToIsoDate(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString().slice(0, 10);
  }
  if (typeof value === 'string' && value.length >= 10) {
    return value.slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

function timestampToMs(value: unknown): number {
  if (value instanceof Timestamp) {
    return value.toMillis();
  }
  return 0;
}

function normalizeCurrency(code: unknown): { code: CurrencyCode; symbol: CurrencySymbol } {
  if (code === 'USD' || code === 'GBP' || code === 'GHS' || code === 'NGN') {
    return { code, symbol: getCurrencySymbol(code) };
  }
  return { code: 'NGN', symbol: '₦' };
}

function normalizeSaleAmounts(
  quantity: number,
  unitPrice: number,
  paymentStatus: PaymentStatus,
  rawAmountPaid: number
): { totalAmount: number; amountPaid: number } {
  const totalAmount = Math.round(quantity * unitPrice * 100) / 100;
  if (paymentStatus === 'Paid') {
    return { totalAmount, amountPaid: totalAmount };
  }
  if (paymentStatus === 'Pending') {
    return { totalAmount, amountPaid: 0 };
  }
  const maxPartial = Math.round((totalAmount - 0.01) * 100) / 100;
  if (maxPartial <= 0) {
    return { totalAmount, amountPaid: 0 };
  }
  const amountPaid = Math.min(maxPartial, Math.max(0.01, Math.round(rawAmountPaid * 100) / 100));
  return { totalAmount, amountPaid };
}

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);

  const [profileLoading, setProfileLoading] = useState(false);
  const [profileExists, setProfileExists] = useState(false);
  const [settings, setSettings] = useState<BusinessSettings>(EMPTY_SETTINGS);

  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<SaleOrder[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadedFlags, setLoadedFlags] = useState({
    products: false,
    sales: false,
    expenses: false,
    customers: false,
  });

  const [fatalError, setFatalError] = useState<Error | null>(null);

  if (fatalError) {
    throw fatalError;
  }

  // 1. Auth State Listener (with iframe-safe fallback if storage init stalls)
  useEffect(() => {
    let resolved = false;
    const fallbackTimer = window.setTimeout(() => {
      if (!resolved) {
        setAuthReady(true);
      }
    }, 3500);

    const unsub = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        resolved = true;
        window.clearTimeout(fallbackTimer);
        setUser(firebaseUser);
        setEmailVerified(Boolean(firebaseUser?.emailVerified));
        setAuthReady(true);
        if (!firebaseUser) {
          setProfileExists(false);
          setProfileLoading(false);
          setSettings(EMPTY_SETTINGS);
          setProducts([]);
          setSales([]);
          setExpenses([]);
          setCustomers([]);
          setLoadedFlags({ products: false, sales: false, expenses: false, customers: false });
        }
      },
      () => {
        resolved = true;
        window.clearTimeout(fallbackTimer);
        setAuthReady(true);
      }
    );
    return () => {
      window.clearTimeout(fallbackTimer);
      unsub();
    };
  }, []);

  const refreshAuthUser = async (): Promise<boolean> => {
    const current = auth.currentUser;
    if (!current) {
      setEmailVerified(false);
      return false;
    }
    await current.reload();
    await current.getIdToken(true);
    const verified = Boolean(auth.currentUser?.emailVerified);
    setEmailVerified(verified);
    setUser(auth.currentUser);
    return verified;
  };

  // 2. User + Business Profile Listeners (/users/{uid} and /businesses/{uid})
  useEffect(() => {
    if (!authReady || !user || !emailVerified) {
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    const userDocPath = `users/${user.uid}`;
    const bizDocPath = `businesses/${user.uid}`;
    const userRef = doc(db, 'users', user.uid);
    const bizRef = doc(db, 'businesses', user.uid);

    let userLoaded = false;
    let bizLoaded = false;
    let userData: Record<string, unknown> | null = null;
    let bizData: Record<string, unknown> | null = null;

    const reconcileProfile = () => {
      if (!userLoaded || !bizLoaded) return;
      if (userData || bizData) {
        const curr = normalizeCurrency(bizData?.currencyCode ?? userData?.currencyCode);
        setSettings({
          userId: String(userData?.userId ?? bizData?.userId ?? user.uid),
          businessId: String(bizData?.businessId ?? userData?.businessId ?? user.uid),
          businessName: String(bizData?.businessName ?? userData?.businessName ?? ''),
          ownerName: String(userData?.name ?? user.displayName ?? ''),
          businessType: String(bizData?.businessCategory ?? userData?.businessType ?? ''),
          rcNumber: String(bizData?.rcNumber ?? userData?.rcNumber ?? ''),
          address: String(bizData?.location ?? userData?.address ?? ''),
          phone: String(bizData?.phone ?? userData?.phone ?? ''),
          email: String(userData?.email ?? user.email ?? ''),
          currencyCode: curr.code,
          currencySymbol: curr.symbol,
          defaultReorderLevel: Number(
            bizData?.defaultReorderLevel ?? userData?.defaultReorderLevel ?? 10
          ),
          vatEnabled: Boolean(bizData?.vatEnabled ?? userData?.vatEnabled ?? true),
          vatRate: Number(bizData?.vatRate ?? userData?.vatRate ?? 7.5),
          createdAt: timestampToIsoDate(userData?.createdAt ?? bizData?.createdAt),
        });
        setProfileExists(true);
      } else {
        setProfileExists(false);
        setSettings({
          ...EMPTY_SETTINGS,
          userId: user.uid,
          businessId: user.uid,
          ownerName: user.displayName ?? '',
          email: user.email ?? '',
        });
      }
      setProfileLoading(false);
    };

    const unsubUser = onSnapshot(
      userRef,
      (snap) => {
        userData = snap.exists() ? (snap.data() as Record<string, unknown>) : null;
        userLoaded = true;
        reconcileProfile();
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, userDocPath);
        } catch (wrapped) {
          setFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    );

    const unsubBiz = onSnapshot(
      bizRef,
      (snap) => {
        bizData = snap.exists() ? (snap.data() as Record<string, unknown>) : null;
        bizLoaded = true;
        reconcileProfile();
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, bizDocPath);
        } catch (wrapped) {
          setFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    );

    return () => {
      unsubUser();
      unsubBiz();
    };
  }, [authReady, user, emailVerified]);

  // 3. Tenant-Scoped Real-Time Listeners for Products, Sales, Expenses, and Customers
  useEffect(() => {
    if (!authReady || !user || !emailVerified || !profileExists) {
      setProducts([]);
      setSales([]);
      setExpenses([]);
      setCustomers([]);
      setLoadedFlags({ products: false, sales: false, expenses: false, customers: false });
      return;
    }

    const uid = user.uid;

    const productsQuery = query(collection(db, 'products'), where('userId', '==', uid));
    const unsubProducts = onSnapshot(
      productsQuery,
      (snap) => {
        const list: Product[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              userId: String(data.userId ?? uid),
              businessId: String(data.businessId ?? uid),
              sku: String(data.sku ?? ''),
              name: String(data.productName ?? ''),
              category: data.category as ProductCategory,
              unit: String(data.unit ?? 'Unit'),
              costPrice: Number(data.costPrice ?? 0),
              unitPrice: Number(data.sellingPrice ?? 0),
              stock: Number(data.quantity ?? 0),
              reorderLevel: Number(data.lowStockThreshold ?? 10),
              updatedAt: timestampToIsoDate(data.updatedAt),
              _createdMs: timestampToMs(data.createdAt),
            };
          })
          .sort((a, b) => b._createdMs - a._createdMs)
          .map(({ _createdMs: _unused, ...rest }) => rest);

        setProducts(list);
        setLoadedFlags((prev) => ({ ...prev, products: true }));
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'products');
        } catch (wrapped) {
          setFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    );

    const salesQuery = query(collection(db, 'sales'), where('userId', '==', uid));
    const unsubSales = onSnapshot(
      salesQuery,
      (snap) => {
        const list: SaleOrder[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              orderNumber: String(data.orderNumber ?? d.id.slice(0, 8).toUpperCase()),
              userId: String(data.userId ?? uid),
              businessId: String(data.businessId ?? uid),
              date: String(data.date ?? ''),
              productId: data.productId ? String(data.productId) : null,
              productName: String(data.product ?? ''),
              quantity: Number(data.quantity ?? 0),
              unitPrice: Number(data.unitPrice ?? 0),
              totalAmount: Number(data.totalAmount ?? 0),
              amountPaid: Number(data.amountPaid ?? 0),
              customerId: data.customerId ? String(data.customerId) : null,
              customerName: String(data.customer ?? ''),
              customerPhone: String(data.customerPhone ?? ''),
              paymentStatus: data.paymentStatus as PaymentStatus,
              paymentMethod: data.paymentMethod as PaymentMethod,
              notes: data.notes ? String(data.notes) : undefined,
              stockDeductedQty: Number(data.stockDeductedQty ?? 0),
              createdAtMs: timestampToMs(data.createdAt),
            };
          })
          .sort((a, b) => {
            if (b.date !== a.date) return b.date.localeCompare(a.date);
            return (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0);
          });

        setSales(list);
        setLoadedFlags((prev) => ({ ...prev, sales: true }));
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'sales');
        } catch (wrapped) {
          setFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    );

    const expensesQuery = query(collection(db, 'expenses'), where('userId', '==', uid));
    const unsubExpenses = onSnapshot(
      expensesQuery,
      (snap) => {
        const list: Expense[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              userId: String(data.userId ?? uid),
              businessId: String(data.businessId ?? uid),
              date: String(data.date ?? ''),
              category: data.category as ExpenseCategory,
              description: String(data.description ?? ''),
              vendor: String(data.vendor ?? ''),
              amount: Number(data.amount ?? 0),
              paymentMethod: data.paymentMethod as PaymentMethod,
              createdAtMs: timestampToMs(data.createdAt),
            };
          })
          .sort((a, b) => {
            if (b.date !== a.date) return b.date.localeCompare(a.date);
            return (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0);
          });

        setExpenses(list);
        setLoadedFlags((prev) => ({ ...prev, expenses: true }));
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'expenses');
        } catch (wrapped) {
          setFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    );

    const customersQuery = query(collection(db, 'customers'), where('userId', '==', uid));
    const unsubCustomers = onSnapshot(
      customersQuery,
      (snap) => {
        const list: Customer[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              userId: String(data.userId ?? uid),
              businessId: String(data.businessId ?? uid),
              name: String(data.name ?? ''),
              phone: String(data.phone ?? ''),
              email: String(data.email ?? ''),
              totalOrders: Number(data.totalOrders ?? 0),
              totalSpent: Number(data.totalSpent ?? 0),
              lastOrderDate: String(data.lastOrderDate ?? ''),
            };
          })
          .sort((a, b) => b.totalSpent - a.totalSpent);

        setCustomers(list);
        setLoadedFlags((prev) => ({ ...prev, customers: true }));
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'customers');
        } catch (wrapped) {
          setFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    );

    return () => {
      unsubProducts();
      unsubSales();
      unsubExpenses();
      unsubCustomers();
    };
  }, [authReady, user, emailVerified, profileExists]);

  const dataLoading =
    profileExists &&
    !(loadedFlags.products && loadedFlags.sales && loadedFlags.expenses && loadedFlags.customers);

  const state: BusinessState = useMemo(
    () => ({ products, sales, expenses, customers, settings }),
    [products, sales, expenses, customers, settings]
  );

  const metrics = useMemo(
    () => calculateDashboardMetrics(sales, expenses, products),
    [sales, expenses, products]
  );

  const lowStockProducts = useMemo(() => getLowStockProducts(products), [products]);
  const topSellingProducts = useMemo(() => getTopSellingProducts(sales, 5), [sales]);
  const expenseByCategory = useMemo(() => getExpenseByCategory(expenses), [expenses]);

  // ---------------------------------------------------------------------------
  // Firestore Write Actions (Blueprint-synchronized & Transaction-Safe)
  // ---------------------------------------------------------------------------

  const createBusinessProfile = async (payload: CreateProfilePayload): Promise<void> => {
    if (!user) throw new Error('You must be signed in to create a business profile.');
    const curr = normalizeCurrency(payload.currencyCode);
    const safeName = sanitizeText(
      payload.name || user.displayName || 'Business Owner',
      BLUEPRINT_LIMITS.nameMax
    );
    const safeEmail = sanitizeText(user.email || 'owner@business.ng', BLUEPRINT_LIMITS.emailMax);
    const safeBizName = sanitizeText(payload.businessName, BLUEPRINT_LIMITS.businessNameMax);
    const safeCategory = sanitizeText(payload.businessType, BLUEPRINT_LIMITS.businessTypeMax);
    const safeLocation = sanitizeText(payload.address, BLUEPRINT_LIMITS.addressMax);
    const safePhone = sanitizeText(payload.phone, BLUEPRINT_LIMITS.phoneMax);

    const userDoc = {
      userId: user.uid,
      businessId: user.uid,
      name: safeName,
      email: safeEmail,
      businessName: safeBizName,
      businessType: safeCategory,
      rcNumber: '',
      address: safeLocation,
      phone: safePhone,
      currencyCode: curr.code,
      currencySymbol: curr.symbol,
      defaultReorderLevel: 10,
      vatEnabled: true,
      vatRate: 7.5,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const businessDoc = {
      businessId: user.uid,
      userId: user.uid,
      businessName: safeBizName,
      businessCategory: safeCategory,
      location: safeLocation,
      phone: safePhone,
      currencyCode: curr.code,
      currencySymbol: curr.symbol,
      rcNumber: '',
      defaultReorderLevel: 10,
      vatEnabled: true,
      vatRate: 7.5,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'users', user.uid), userDoc);
      batch.set(doc(db, 'businesses', user.uid), businessDoc);
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `businesses/${user.uid}`);
    }
  };

  const signOutUser = async (): Promise<void> => {
    await signOut(auth);
  };

  const recordSale = async (payload: SaleFormPayload): Promise<SaleOrder> => {
    if (!user) throw new Error('Authentication required.');

    const saleId = payload.draftSaleId || generateDocumentId('sale');
    const orderNumber = generateNextOrderNumber(sales);
    const { totalAmount, amountPaid } = normalizeSaleAmounts(
      payload.quantity,
      payload.unitPrice,
      payload.paymentStatus,
      payload.amountPaid
    );

    const safeProductId = payload.productId ? sanitizeText(payload.productId, BLUEPRINT_LIMITS.idMax) : '';
    const safeCustomerName = sanitizeText(payload.customerName, BLUEPRINT_LIMITS.customerMax);
    const safeCustomerPhone = sanitizeText(payload.customerPhone || '', BLUEPRINT_LIMITS.phoneMax);
    const matchedCustomer = customers.find(
      (c) => c.name.trim().toLowerCase() === safeCustomerName.toLowerCase()
    );
    const customerId = matchedCustomer?.id ?? generateDocumentId('cust');
    const salePath = `sales/${saleId}`;

    try {
      let finalDeductedQty = 0;

      await runTransaction(db, async (tx) => {
        const saleRef = doc(db, 'sales', saleId);
        const existingSaleSnap = await tx.get(saleRef);

        // Idempotency guard: prevent accidental duplicate creation or double stock deduction
        if (existingSaleSnap.exists()) {
          const prevData = existingSaleSnap.data();
          finalDeductedQty = Number(prevData.stockDeductedQty ?? 0);
          return;
        }

        const productRef = safeProductId ? doc(db, 'products', safeProductId) : null;
        const productSnap = productRef ? await tx.get(productRef) : null;

        const customerRef = doc(db, 'customers', customerId);
        const customerSnap = await tx.get(customerRef);

        // Deduct stock safely inside transaction
        if (productRef && productSnap && productSnap.exists()) {
          const prodData = productSnap.data();
          if (prodData.userId === user.uid) {
            const currentStock = Math.max(0, Number(prodData.quantity ?? 0));
            finalDeductedQty = Math.min(currentStock, Math.round(payload.quantity));
            tx.update(productRef, {
              quantity: Math.max(0, currentStock - finalDeductedQty),
              updatedAt: serverTimestamp(),
            });
          }
        }

        // Upsert customer record inside transaction
        if (customerSnap.exists()) {
          const prevCust = customerSnap.data();
          if (prevCust.userId === user.uid) {
            tx.update(customerRef, {
              name: safeCustomerName,
              phone: safeCustomerPhone || String(prevCust.phone ?? ''),
              email: String(prevCust.email ?? ''),
              totalOrders: Number(prevCust.totalOrders ?? 0) + 1,
              totalSpent: Math.round((Number(prevCust.totalSpent ?? 0) + totalAmount) * 100) / 100,
              lastOrderDate: payload.date,
              updatedAt: serverTimestamp(),
            });
          }
        } else {
          tx.set(customerRef, {
            customerId,
            userId: user.uid,
            businessId: user.uid,
            name: safeCustomerName,
            phone: safeCustomerPhone,
            email: '',
            totalOrders: 1,
            totalSpent: totalAmount,
            lastOrderDate: payload.date,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        tx.set(saleRef, {
          saleId,
          orderNumber: sanitizeText(orderNumber, BLUEPRINT_LIMITS.orderNumberMax),
          userId: user.uid,
          businessId: user.uid,
          productId: safeProductId,
          product: sanitizeText(payload.productName, BLUEPRINT_LIMITS.productNameMax),
          quantity: payload.quantity,
          unitPrice: payload.unitPrice,
          totalAmount,
          amountPaid,
          customerId,
          customer: safeCustomerName,
          customerPhone: safeCustomerPhone,
          paymentStatus: payload.paymentStatus,
          paymentMethod: payload.paymentMethod,
          date: payload.date,
          notes: sanitizeText(payload.notes || '', BLUEPRINT_LIMITS.notesMax),
          stockDeductedQty: finalDeductedQty,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      return {
        id: saleId,
        orderNumber,
        userId: user.uid,
        businessId: user.uid,
        date: payload.date,
        productId: safeProductId || null,
        productName: sanitizeText(payload.productName, BLUEPRINT_LIMITS.productNameMax),
        quantity: payload.quantity,
        unitPrice: payload.unitPrice,
        totalAmount,
        amountPaid,
        customerId,
        customerName: safeCustomerName,
        customerPhone: safeCustomerPhone || 'Not provided',
        paymentStatus: payload.paymentStatus,
        paymentMethod: payload.paymentMethod,
        notes: sanitizeText(payload.notes || '', BLUEPRINT_LIMITS.notesMax) || undefined,
        stockDeductedQty: finalDeductedQty,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, salePath);
    }
  };

  const updateSale = async (saleId: string, payload: SaleFormPayload): Promise<void> => {
    if (!user) throw new Error('Authentication required.');
    const salePath = `sales/${saleId}`;
    const { totalAmount, amountPaid } = normalizeSaleAmounts(
      payload.quantity,
      payload.unitPrice,
      payload.paymentStatus,
      payload.amountPaid
    );

    const nextProductId = payload.productId ? sanitizeText(payload.productId, BLUEPRINT_LIMITS.idMax) : '';
    const safeCustomerName = sanitizeText(payload.customerName, BLUEPRINT_LIMITS.customerMax);
    const safeCustomerPhone = sanitizeText(payload.customerPhone || '', BLUEPRINT_LIMITS.phoneMax);

    try {
      await runTransaction(db, async (tx) => {
        const saleRef = doc(db, 'sales', saleId);
        const saleSnap = await tx.get(saleRef);
        if (!saleSnap.exists()) return;

        const existingSale = saleSnap.data();
        if (existingSale.userId !== user.uid) {
          throw new Error('Permission denied editing another user’s sale.');
        }

        const prevProductId = existingSale.productId ? String(existingSale.productId) : null;
        const prevDeductedQty = Number(existingSale.stockDeductedQty ?? 0);

        // Read all affected products before writing
        const productIdsToRead = Array.from(
          new Set([prevProductId, nextProductId || null].filter((id): id is string => Boolean(id)))
        );
        const currentStockByProductId: Record<string, number> = {};
        for (const pid of productIdsToRead) {
          const pSnap = await tx.get(doc(db, 'products', pid));
          if (pSnap.exists() && pSnap.data().userId === user.uid) {
            currentStockByProductId[pid] = Math.max(0, Number(pSnap.data().quantity ?? 0));
          }
        }

        const { adjustments, nextStockDeductedQty } = computeSaleStockDelta({
          previousProductId: prevProductId,
          previousDeductedQty: prevDeductedQty,
          nextProductId: nextProductId || null,
          nextQuantity: payload.quantity,
          currentStockByProductId,
        });

        for (const [pid, nextStock] of Object.entries(adjustments)) {
          tx.update(doc(db, 'products', pid), {
            quantity: nextStock,
            updatedAt: serverTimestamp(),
          });
        }

        tx.update(saleRef, {
          productId: nextProductId,
          product: sanitizeText(payload.productName, BLUEPRINT_LIMITS.productNameMax),
          quantity: payload.quantity,
          unitPrice: payload.unitPrice,
          totalAmount,
          amountPaid,
          customerId: existingSale.customerId ? String(existingSale.customerId) : '',
          customer: safeCustomerName,
          customerPhone: safeCustomerPhone,
          paymentStatus: payload.paymentStatus,
          paymentMethod: payload.paymentMethod,
          date: payload.date,
          notes: sanitizeText(payload.notes || '', BLUEPRINT_LIMITS.notesMax),
          stockDeductedQty: nextStockDeductedQty,
          updatedAt: serverTimestamp(),
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, salePath);
    }
  };

  const markOrderPaid = async (orderId: string): Promise<void> => {
    if (!user) throw new Error('Authentication required.');
    const target = sales.find((o) => o.id === orderId);
    if (!target || target.paymentStatus === 'Paid') return;

    const path = `sales/${orderId}`;
    try {
      await updateDoc(doc(db, 'sales', orderId), {
        paymentStatus: 'Paid',
        amountPaid: target.totalAmount,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deleteSale = async (orderId: string): Promise<void> => {
    if (!user) throw new Error('Authentication required.');
    const path = `sales/${orderId}`;
    try {
      await runTransaction(db, async (tx) => {
        const saleRef = doc(db, 'sales', orderId);
        const saleSnap = await tx.get(saleRef);
        if (!saleSnap.exists()) return;

        const data = saleSnap.data();
        if (data.userId !== user.uid) {
          throw new Error('Unauthorized sale deletion attempt.');
        }
        const linkedProductId = data.productId ? String(data.productId) : null;
        const deductedQty = Math.max(0, Number(data.stockDeductedQty ?? 0));

        if (linkedProductId && deductedQty > 0) {
          const prodRef = doc(db, 'products', linkedProductId);
          const prodSnap = await tx.get(prodRef);
          if (prodSnap.exists() && prodSnap.data().userId === user.uid) {
            const currentStock = Math.max(0, Number(prodSnap.data().quantity ?? 0));
            tx.update(prodRef, {
              quantity: currentStock + deductedQty,
              updatedAt: serverTimestamp(),
            });
          }
        }

        tx.delete(saleRef);
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const recordExpense = async (payload: ExpenseFormPayload): Promise<Expense> => {
    if (!user) throw new Error('Authentication required.');
    const expenseId = generateDocumentId('exp');
    const path = `expenses/${expenseId}`;

    const expenseDoc = {
      expenseId,
      userId: user.uid,
      businessId: user.uid,
      category: payload.category,
      description: sanitizeText(payload.description, BLUEPRINT_LIMITS.descriptionMax),
      vendor: sanitizeText(payload.vendor, BLUEPRINT_LIMITS.vendorMax),
      amount: Math.round(payload.amount * 100) / 100,
      paymentMethod: payload.paymentMethod,
      date: payload.date,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'expenses', expenseId), expenseDoc);
      return {
        id: expenseId,
        userId: user.uid,
        businessId: user.uid,
        date: expenseDoc.date,
        category: expenseDoc.category,
        description: expenseDoc.description,
        vendor: expenseDoc.vendor,
        amount: expenseDoc.amount,
        paymentMethod: expenseDoc.paymentMethod,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const updateExpense = async (expenseId: string, payload: ExpenseFormPayload): Promise<void> => {
    if (!user) throw new Error('Authentication required.');
    const path = `expenses/${expenseId}`;
    try {
      await updateDoc(doc(db, 'expenses', expenseId), {
        category: payload.category,
        description: sanitizeText(payload.description, BLUEPRINT_LIMITS.descriptionMax),
        vendor: sanitizeText(payload.vendor, BLUEPRINT_LIMITS.vendorMax),
        amount: Math.round(payload.amount * 100) / 100,
        paymentMethod: payload.paymentMethod,
        date: payload.date,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deleteExpense = async (expenseId: string): Promise<void> => {
    if (!user) throw new Error('Authentication required.');
    const path = `expenses/${expenseId}`;
    try {
      await deleteDoc(doc(db, 'expenses', expenseId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const addProduct = async (payload: ProductFormPayload): Promise<Product> => {
    if (!user) throw new Error('Authentication required.');
    const productId = generateDocumentId('prod');
    const path = `products/${productId}`;

    const prodDoc = {
      productId,
      userId: user.uid,
      businessId: user.uid,
      sku: sanitizeText(payload.sku.toUpperCase(), BLUEPRINT_LIMITS.skuMax),
      productName: sanitizeText(payload.name, BLUEPRINT_LIMITS.productNameMax),
      category: payload.category,
      unit: sanitizeText(payload.unit || 'Unit', BLUEPRINT_LIMITS.unitMax),
      costPrice: Math.max(0, payload.costPrice),
      sellingPrice: payload.unitPrice,
      quantity: Math.max(0, Math.round(payload.stock)),
      lowStockThreshold: Math.max(0, Math.round(payload.reorderLevel)),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'products', productId), prodDoc);
      return {
        id: productId,
        userId: user.uid,
        businessId: user.uid,
        sku: prodDoc.sku,
        name: prodDoc.productName,
        category: prodDoc.category,
        unit: prodDoc.unit,
        costPrice: prodDoc.costPrice,
        unitPrice: prodDoc.sellingPrice,
        stock: prodDoc.quantity,
        reorderLevel: prodDoc.lowStockThreshold,
        updatedAt: new Date().toISOString().slice(0, 10),
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const updateProduct = async (productId: string, payload: ProductFormPayload): Promise<void> => {
    if (!user) throw new Error('Authentication required.');
    const path = `products/${productId}`;
    try {
      await updateDoc(doc(db, 'products', productId), {
        sku: sanitizeText(payload.sku.toUpperCase(), BLUEPRINT_LIMITS.skuMax),
        productName: sanitizeText(payload.name, BLUEPRINT_LIMITS.productNameMax),
        category: payload.category,
        unit: sanitizeText(payload.unit || 'Unit', BLUEPRINT_LIMITS.unitMax),
        costPrice: Math.max(0, payload.costPrice),
        sellingPrice: payload.unitPrice,
        quantity: Math.max(0, Math.round(payload.stock)),
        lowStockThreshold: Math.max(0, Math.round(payload.reorderLevel)),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const restockProduct = async (productId: string, addedQuantity: number): Promise<void> => {
    if (!user) throw new Error('Authentication required.');
    if (!Number.isFinite(addedQuantity) || addedQuantity <= 0) return;

    const path = `products/${productId}`;
    try {
      await runTransaction(db, async (tx) => {
        const prodRef = doc(db, 'products', productId);
        const prodSnap = await tx.get(prodRef);
        if (!prodSnap.exists()) return;
        if (prodSnap.data().userId !== user.uid) {
          throw new Error('Unauthorized product restock attempt.');
        }
        const currentStock = Math.max(0, Number(prodSnap.data().quantity ?? 0));
        tx.update(prodRef, {
          quantity: currentStock + Math.round(addedQuantity),
          updatedAt: serverTimestamp(),
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deleteProduct = async (productId: string): Promise<void> => {
    if (!user) throw new Error('Authentication required.');
    const path = `products/${productId}`;
    try {
      await deleteDoc(doc(db, 'products', productId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const updateSettings = async (next: BusinessSettings): Promise<void> => {
    if (!user) throw new Error('Authentication required.');
    const curr = normalizeCurrency(next.currencyCode);
    const safeName = sanitizeText(next.ownerName, BLUEPRINT_LIMITS.nameMax);
    const rawEmail = sanitizeText(next.email, BLUEPRINT_LIMITS.emailMax);
    const safeEmail =
      rawEmail.length >= 3
        ? rawEmail
        : sanitizeText(user.email || 'owner@business.ng', BLUEPRINT_LIMITS.emailMax);
    const safeBizName = sanitizeText(next.businessName, BLUEPRINT_LIMITS.businessNameMax);
    const safeCategory = sanitizeText(next.businessType, BLUEPRINT_LIMITS.businessTypeMax);
    const safeRc = sanitizeText(next.rcNumber, BLUEPRINT_LIMITS.rcNumberMax);
    const safeLocation = sanitizeText(next.address, BLUEPRINT_LIMITS.addressMax);
    const safePhone = sanitizeText(next.phone, BLUEPRINT_LIMITS.phoneMax);
    const safeReorder = Math.max(0, Math.min(100000, Math.round(next.defaultReorderLevel)));
    const safeVatEnabled = Boolean(next.vatEnabled);
    const safeVatRate = Math.max(0, Math.min(100, Number(next.vatRate) || 0));

    const userRef = doc(db, 'users', user.uid);
    const bizRef = doc(db, 'businesses', user.uid);

    try {
      const [userSnap, bizSnap] = await Promise.all([getDoc(userRef), getDoc(bizRef)]);
      const batch = writeBatch(db);

      const userPayload = {
        businessId: user.uid,
        name: safeName,
        email: safeEmail,
        businessName: safeBizName,
        businessType: safeCategory,
        rcNumber: safeRc,
        address: safeLocation,
        phone: safePhone,
        currencyCode: curr.code,
        currencySymbol: curr.symbol,
        defaultReorderLevel: safeReorder,
        vatEnabled: safeVatEnabled,
        vatRate: safeVatRate,
        updatedAt: serverTimestamp(),
      };

      if (userSnap.exists()) {
        batch.update(userRef, userPayload);
      } else {
        batch.set(userRef, {
          userId: user.uid,
          ...userPayload,
          createdAt: serverTimestamp(),
        });
      }

      if (bizSnap.exists()) {
        batch.update(bizRef, {
          businessName: safeBizName,
          businessCategory: safeCategory,
          location: safeLocation,
          phone: safePhone,
          currencyCode: curr.code,
          currencySymbol: curr.symbol,
          rcNumber: safeRc,
          defaultReorderLevel: safeReorder,
          vatEnabled: safeVatEnabled,
          vatRate: safeVatRate,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(bizRef, {
          businessId: user.uid,
          userId: user.uid,
          businessName: safeBizName,
          businessCategory: safeCategory,
          location: safeLocation,
          phone: safePhone,
          currencyCode: curr.code,
          currencySymbol: curr.symbol,
          rcNumber: safeRc,
          defaultReorderLevel: safeReorder,
          vatEnabled: safeVatEnabled,
          vatRate: safeVatRate,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `businesses/${user.uid}`);
    }
  };

  return (
    <BusinessContext.Provider
      value={{
        user,
        authReady,
        emailVerified,
        profileLoading,
        profileExists,
        dataLoading,
        state,
        metrics,
        lowStockProducts,
        topSellingProducts,
        expenseByCategory,
        refreshAuthUser,
        createBusinessProfile,
        signOutUser,
        recordSale,
        updateSale,
        markOrderPaid,
        deleteSale,
        recordExpense,
        updateExpense,
        deleteExpense,
        addProduct,
        updateProduct,
        restockProduct,
        deleteProduct,
        updateSettings,
      }}
    >
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness(): BusinessContextValue {
  const ctx = useContext(BusinessContext);
  if (!ctx) {
    throw new Error('useBusiness must be used inside BusinessProvider');
  }
  return ctx;
}
