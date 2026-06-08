export type TransactionType = "Income" | "Expense";

export const CATEGORIES = [
  "Food & Dining",
  "Gas & Fuel",
  "Groceries",
  "Shopping",
  "Subscriptions",
  "Entertainment",
  "Healthcare",
  "Utilities",
  "Travel",
  "Other",
  "Credit Card Payment",
  "Uncategorized",
] as const;

export type Category = typeof CATEGORIES[number];

export interface Transaction {
  date: string;
  description: string;
  amount: number;
  category: string;
  source: string;
  type: TransactionType;
}

export interface UploadResponse {
  transactions: Transaction[];
  source: string;
  count: number;
}

export type ConfirmResult =
  | { kind: "downloaded" }
  | { kind: "written"; status: "written" | "created" };
