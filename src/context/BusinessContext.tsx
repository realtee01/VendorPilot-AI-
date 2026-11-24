import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
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
import {
  calculateDashboardMetrics,
  DashboardMetrics,
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
}

interface NewSalePayload {
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

interface NewExpensePayload {
  date: string;
  category: ExpenseCategory;
  description: string;
  vendor: string;
  amount: number;
  paymentMethod: PaymentMethod;
}

interface NewProductPayload {
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
  profileLoading: boolean;
  profileExists: boolean;
  dataLoading: boolean;
  state: BusinessState;
  metrics: DashboardMetrics;
  lowStockProducts: Product[];
  topSellingProducts: TopProductItem[];
  expenseByCategory: ExpenseCategorySummary[];
  createBusinessProfile: (payload: CreateProfilePayload) => Promise<void>;
  signOutUser: () => Promise<void>;
  recordSale: (payload: NewSalePayload) => Promise<SaleOrder>;
  markOrderPaid: (orderId: string) => Promise<void>;
  deleteSale: (orderId: string) => Promise<void>;
  recordExpense: (payload: NewExpensePayload) => Promise<Expense>;
  deleteExpense: (expenseId: string) => Promise<void>;
  addProduct: (payload: NewProductPayload) => Promise<Product>;
  updateProduct: (productId: string, payload: NewProductPayload) => Promise<void>;
  restockProduct: (productId: string, addedQuantity: number) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  updateSettings: (settings: BusinessSettings) => Promise<void>;
}

const EMPTY_SETTINGS: BusinessSettings = {
  userId: '',
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

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [profileLoading, setProfileLoading] = useState(false);
  const [profileExists, setProfileExists] = useState(false);
  const [settings, setSettings] = useState<BusinessSettings>(EMPTY_SETTINGS);

  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<SaleOrder[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadedFlags, setLoadedFlags] = useState({
    inventory: false,
    sales: false,
    expenses: false,
  });

  const [fatalError, setFatalError] = useState<Error | null>(null);

  // Surface async Firestore listener errors to React ErrorBoundary
  if (fatalError) {
    throw fatalError;
  }

  // 1. Auth State Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        setProfileExists(false);
        setProfileLoading(false);
        setSettings(EMPTY_SETTINGS);
        setProducts([]);
        setSales([]);
        setExpenses([]);
        setLoadedFlags({ inventory: false, sales: false, expenses: false });
      }
    });
    return () => unsub();
  }, []);

  // 2. User Profile Listener (only when auth is ready and user is authenticated)
  useEffect(() => {
    if (!authReady || !user) return;
    setProfileLoading(true);
    const userDocPath = `users/${user.uid}`;
    const userRef = doc(db, 'users', user.uid);

    const unsub = onSnapshot(
      userRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setSettings({
            userId: String(data.userId ?? user.uid),
            businessName: String(data.businessName ?? ''),
            ownerName: String(data.name ?? user.displayName ?? ''),
            businessType: String(data.businessType ?? ''),
            rcNumber: String(data.rcNumber ?? ''),
            address: String(data.address ?? ''),
            phone: String(data.phone ?? ''),
            email: String(data.email ?? user.email ?? ''),
            currencyCode: 'NGN',
            currencySymbol: '₦',
            defaultReorderLevel: Number(data.defaultReorderLevel ?? 10),
            vatEnabled: Boolean(data.vatEnabled ?? true),
            vatRate: Number(data.vatRate ?? 7.5),
            createdAt: timestampToIsoDate(data.createdAt),
          });
          setProfileExists(true);
        } else {
          setProfileExists(false);
          setSettings({
            ...EMPTY_SETTINGS,
            userId: user.uid,
            ownerName: user.displayName ?? '',
            email: user.email ?? '',
          });
        }
        setProfileLoading(false);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, userDocPath);
        } catch (wrapped) {
          setFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    );

    return () => unsub();
  }, [authReady, user]);

  // 3. Tenant-Scoped Real-Time Listeners for Inventory, Sales, and Expenses
  useEffect(() => {
    if (!authReady || !user || !profileExists) {
      setProducts([]);
      setSales([]);
      setExpenses([]);
      setLoadedFlags({ inventory: false, sales: false, expenses: false });
      return;
    }

    const uid = user.uid;

    const invQuery = query(collection(db, 'inventory'), where('userId', '==', uid));
    const unsubInv = onSnapshot(
      invQuery,
      (snap) => {
        const list: Product[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              userId: String(data.userId ?? uid),
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
        setLoadedFlags((prev) => ({ ...prev, inventory: true }));
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'inventory');
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
              date: String(data.date ?? ''),
              productId: data.productId ? String(data.productId) : null,
              productName: String(data.product ?? ''),
              quantity: Number(data.quantity ?? 0),
              unitPrice: Number(data.unitPrice ?? 0),
              totalAmount: Number(data.totalAmount ?? 0),
              amountPaid: Number(data.amountPaid ?? 0),
              customerName: String(data.customer ?? ''),
              customerPhone: String(data.customerPhone ?? ''),
              paymentStatus: data.paymentStatus as PaymentStatus,
              paymentMethod: data.paymentMethod as PaymentMethod,
              notes: data.notes ? String(data.notes) : undefined,
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

    return () => {
      unsubInv();
      unsubSales();
      unsubExpenses();
    };
  }, [authReady, user, profileExists]);

  const dataLoading =
    profileExists && !(loadedFlags.inventory && loadedFlags.sales && loadedFlags.expenses);

  const state: BusinessState = useMemo(
    () => ({ products, sales, expenses, settings }),
    [products, sales, expenses, settings]
  );

  const metrics = useMemo(
    () => calculateDashboardMetrics(sales, expenses, products),
    [sales, expenses, products]
  );

  const lowStockProducts = useMemo(() => getLowStockProducts(products), [products]);
  const topSellingProducts = useMemo(() => getTopSellingProducts(sales, 5), [sales]);
  const expenseByCategory = useMemo(() => getExpenseByCategory(expenses), [expenses]);

  // ---------------------------------------------------------------------------
  // Firestore Write Actions (Blueprint-synchronized & Error-Handled)
  // ---------------------------------------------------------------------------

  const createBusinessProfile = async (payload: CreateProfilePayload): Promise<void> => {
    if (!user) throw new Error('You must be signed in to create a business profile.');
    const path = `users/${user.uid}`;
    const docData = {
      userId: user.uid,
      name: sanitizeText(payload.name || user.displayName || 'Business Owner', BLUEPRINT_LIMITS.nameMax),
      email: sanitizeText(user.email || 'owner@business.ng', BLUEPRINT_LIMITS.emailMax),
      businessName: sanitizeText(payload.businessName, BLUEPRINT_LIMITS.businessNameMax),
      businessType: sanitizeText(payload.businessType, BLUEPRINT_LIMITS.businessTypeMax),
      rcNumber: '',
      address: sanitizeText(payload.address, BLUEPRINT_LIMITS.addressMax),
      phone: sanitizeText(payload.phone, BLUEPRINT_LIMITS.phoneMax),
      currencyCode: 'NGN',
      currencySymbol: '₦',
      defaultReorderLevel: 10,
      vatEnabled: true,
      vatRate: 7.5,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'users', user.uid), docData);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const signOutUser = async (): Promise<void> => {
    await signOut(auth);
  };

  const recordSale = async (payload: NewSalePayload): Promise<SaleOrder> => {
    if (!user) throw new Error('Authentication required.');

    const saleId = generateDocumentId('sale');
    const orderNumber = `VP-${String(1001 + sales.length).padStart(4, '0')}`;
    const totalAmount = Math.round(payload.quantity * payload.unitPrice * 100) / 100;
    const amountPaid =
      payload.paymentStatus === 'Paid'
        ? totalAmount
        : payload.paymentStatus === 'Pending'
          ? 0
          : Math.min(
              Math.round((totalAmount - 0.01) * 100) / 100,
              Math.max(0.01, Math.round(payload.amountPaid * 100) / 100)
            );

    const safeProductId = payload.productId ? sanitizeText(payload.productId, BLUEPRINT_LIMITS.idMax) : '';
    const salePath = `sales/${saleId}`;

    const saleDoc = {
      saleId,
      orderNumber: sanitizeText(orderNumber, BLUEPRINT_LIMITS.orderNumberMax),
      userId: user.uid,
      productId: safeProductId,
      product: sanitizeText(payload.productName, BLUEPRINT_LIMITS.productNameMax),
      quantity: payload.quantity,
      unitPrice: payload.unitPrice,
      totalAmount,
      amountPaid,
      customer: sanitizeText(payload.customerName, BLUEPRINT_LIMITS.customerMax),
      customerPhone: sanitizeText(payload.customerPhone || '', BLUEPRINT_LIMITS.phoneMax),
      paymentStatus: payload.paymentStatus,
      paymentMethod: payload.paymentMethod,
      date: payload.date,
      notes: sanitizeText(payload.notes || '', BLUEPRINT_LIMITS.notesMax),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      const linkedProduct = safeProductId
        ? products.find((p) => p.id === safeProductId && p.userId === user.uid)
        : undefined;

      if (linkedProduct) {
        const batch = writeBatch(db);
        batch.set(doc(db, 'sales', saleId), saleDoc);
        batch.update(doc(db, 'inventory', linkedProduct.id), {
          quantity: Math.max(0, linkedProduct.stock - payload.quantity),
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
      } else {
        await setDoc(doc(db, 'sales', saleId), saleDoc);
      }

      return {
        id: saleId,
        orderNumber: saleDoc.orderNumber,
        userId: user.uid,
        date: saleDoc.date,
        productId: safeProductId || null,
        productName: saleDoc.product,
        quantity: saleDoc.quantity,
        unitPrice: saleDoc.unitPrice,
        totalAmount: saleDoc.totalAmount,
        amountPaid: saleDoc.amountPaid,
        customerName: saleDoc.customer,
        customerPhone: saleDoc.customerPhone || 'Not provided',
        paymentStatus: saleDoc.paymentStatus,
        paymentMethod: saleDoc.paymentMethod,
        notes: saleDoc.notes || undefined,
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, salePath);
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
      await deleteDoc(doc(db, 'sales', orderId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const recordExpense = async (payload: NewExpensePayload): Promise<Expense> => {
    if (!user) throw new Error('Authentication required.');
    const expenseId = generateDocumentId('exp');
    const path = `expenses/${expenseId}`;

    const expenseDoc = {
      expenseId,
      userId: user.uid,
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

  const deleteExpense = async (expenseId: string): Promise<void> => {
    if (!user) throw new Error('Authentication required.');
    const path = `expenses/${expenseId}`;
    try {
      await deleteDoc(doc(db, 'expenses', expenseId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const addProduct = async (payload: NewProductPayload): Promise<Product> => {
    if (!user) throw new Error('Authentication required.');
    const productId = generateDocumentId('prod');
    const path = `inventory/${productId}`;

    const prodDoc = {
      productId,
      userId: user.uid,
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
      await setDoc(doc(db, 'inventory', productId), prodDoc);
      return {
        id: productId,
        userId: user.uid,
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

  const updateProduct = async (productId: string, payload: NewProductPayload): Promise<void> => {
    if (!user) throw new Error('Authentication required.');
    const path = `inventory/${productId}`;
    try {
      await updateDoc(doc(db, 'inventory', productId), {
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
    const target = products.find((p) => p.id === productId);
    if (!target) return;

    const path = `inventory/${productId}`;
    try {
      await updateDoc(doc(db, 'inventory', productId), {
        quantity: target.stock + Math.round(addedQuantity),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deleteProduct = async (productId: string): Promise<void> => {
    if (!user) throw new Error('Authentication required.');
    const path = `inventory/${productId}`;
    try {
      await deleteDoc(doc(db, 'inventory', productId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const updateSettings = async (next: BusinessSettings): Promise<void> => {
    if (!user) throw new Error('Authentication required.');
    const path = `users/${user.uid}`;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name: sanitizeText(next.ownerName, BLUEPRINT_LIMITS.nameMax),
        email: sanitizeText(next.email, BLUEPRINT_LIMITS.emailMax),
        businessName: sanitizeText(next.businessName, BLUEPRINT_LIMITS.businessNameMax),
        businessType: sanitizeText(next.businessType, BLUEPRINT_LIMITS.businessTypeMax),
        rcNumber: sanitizeText(next.rcNumber, BLUEPRINT_LIMITS.rcNumberMax),
        address: sanitizeText(next.address, BLUEPRINT_LIMITS.addressMax),
        phone: sanitizeText(next.phone, BLUEPRINT_LIMITS.phoneMax),
        defaultReorderLevel: Math.max(0, Math.min(100000, Math.round(next.defaultReorderLevel))),
        vatEnabled: Boolean(next.vatEnabled),
        vatRate: Math.max(0, Math.min(100, Number(next.vatRate) || 0)),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  return (
    <BusinessContext.Provider
      value={{
        user,
        authReady,
        profileLoading,
        profileExists,
        dataLoading,
        state,
        metrics,
        lowStockProducts,
        topSellingProducts,
        expenseByCategory,
        createBusinessProfile,
        signOutUser,
        recordSale,
        markOrderPaid,
        deleteSale,
        recordExpense,
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
