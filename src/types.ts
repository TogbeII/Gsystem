export type UserRole = "admin" | "user" | "manager";

export interface UserPermissions {
  inventory: { view: boolean; create: boolean; edit: boolean; delete: boolean };
  customers: { view: boolean; create: boolean; edit: boolean; delete: boolean };
  sales: { view: boolean; create: boolean; history: boolean };
  credit: { view: boolean; payment: boolean };
  admin: { view: boolean; users: boolean; settings: boolean };
}

export interface User {
  username: string;
  role: UserRole;
  fullName: string;
  permissions: UserPermissions;
}

export interface License {
  key: string;
  type: string;
  activatedAt: string;
  expiresAt: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  shopStock: number;
  warehouseStock: number;
  bulkUnitSize: number; // e.g. 12 if stored in boxes of 12
  bulkUnitName: string; // e.g. "Box", "Sack", "Large Item"
  description: string;
  sku: string;
  hasShopInventory?: boolean;
  hasWarehouseInventory?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  balance: number;
}

export interface SaleItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  customerId?: string;
  customerName?: string;
  total: number;
  paymentType: "cash" | "credit" | "mobile_money";
  amountPaid: number;
  date: string;
}

export interface PaymentRecord {
  id: string;
  customerId: string;
  amount: number;
  type: string;
  date: string;
  saleId?: string;
}
