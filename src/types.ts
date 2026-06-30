export type ExpenseCategory = '會議餐點' | '電腦周邊' | '文具用品' | '其他' | (string & {});

export interface ExpenseRecord {
  id: string; // Unique transaction identifier
  date: string; // YYYY-MM-DD
  category: ExpenseCategory;
  amount: number;
  remark: string;
}

export interface AttendeeDetail {
  id: string; // Matches ExpenseRecord.id
  date: string;
  category: ExpenseCategory;
  amount: number;
  attendees: string[]; // List of names
  count: number;
  average: number;
}

export interface Person {
  id: string;
  name: string;
  isActive: boolean; // Selected as candidate for drawing
  isRequired: boolean; // Must be included if drawn
}

export interface CategoryConfig {
  category: ExpenseCategory;
  unitCost?: number; // 500 for meal
  defaultCount?: number; // 1 for computer peripheral
}
