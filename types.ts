
export enum AppView {
  LOGIN = 'LOGIN',
  REGISTER = 'REGISTER',
  DASHBOARD = 'DASHBOARD',
  APPLY_LOAN = 'APPLY_LOAN',
  RANK_LIMITS = 'RANK_LIMITS',
  STATUS = 'STATUS',
  PROFILE = 'PROFILE',
  // Admin Views
  ADMIN_DASHBOARD = 'ADMIN_DASHBOARD',
  ADMIN_USERS = 'ADMIN_USERS',
  ADMIN_LOANS = 'ADMIN_LOANS',
  ADMIN_BUDGET = 'ADMIN_BUDGET',
  ADMIN_SYSTEM = 'ADMIN_SYSTEM'
}

export type UserRank = 'standard' | 'bronze' | 'silver' | 'gold' | 'diamond';

export interface User {
  id: string;
  phone: string;
  fullName: string;
  idNumber: string;
  balance: number; // Hạn mức còn lại
  totalLimit: number; // Tổng hạn mức được cấp
  rank: UserRank;
  rankProgress: number; 
  isLoggedIn: boolean;
  isAdmin?: boolean;
  pendingUpgradeRank?: UserRank | null;
  rankUpgradeBill?: string; // Ảnh bill nâng hạng
  address?: string;
  joinDate?: string;
  // KYC & Reference fields
  idFront?: string;
  idBack?: string;
  refZalo?: string;
  relationship?: string;
  password?: string;
  lastLoanSeq?: number; // Lưu số thứ tự khoản vay cuối cùng để tránh trùng mã khi xóa lịch sử
  // Bank account info
  bankName?: string;
  bankBin?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  hasJoinedZalo?: boolean;
  payosOrderCode?: number;
  payosCheckoutUrl?: string;
  payosExpireAt?: number;
  updatedAt?: number;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'LOAN' | 'RANK' | 'SYSTEM';
}

export interface LoanRecord {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  date: string; 
  createdAt: string; 
  status: 'CHỜ DUYỆT' | 'ĐÃ DUYỆT' | 'ĐANG GIẢI NGÂN' | 'ĐANG NỢ' | 'ĐANG ĐỐI SOÁT' | 'CHỜ TẤT TOÁN' | 'ĐÃ TẤT TOÁN' | 'BỊ TỪ CHỐI';
  fine?: number;
  billImage?: string;
  bankTransactionId?: string;
  signature?: string; // Lưu trữ DataURL của chữ ký
  rejectionReason?: string;
  settlementType?: 'ALL' | 'PRINCIPAL' | 'PARTIAL';
  partialAmount?: number;
  principalPaymentCount?: number;
  extensionCount?: number;
  payosOrderCode?: number;
  payosCheckoutUrl?: string;
  payosExpireAt?: number;
  updatedAt?: number;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

// Added LogEntry interface to fix the error in components/AdminLogs.tsx
export interface LogEntry {
  id: string;
  user: string;
  time: string;
  action: string;
  ip: string;
  device: string;
}

export interface MonthlyStat {
  month: string; // Format: "MM/YYYY"
  rankProfit: number;
  loanProfit: number;
  totalProfit: number;
}

export interface AppSettings {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  IMGBB_API_KEY: string;
  PAYMENT_ACCOUNT: {
    bankName: string;
    bankBin?: string;
    accountNumber: string;
    accountName: string;
  };
  PRE_DISBURSEMENT_FEE: number | string;
  MAX_EXTENSIONS: number | string;
  UPGRADE_PERCENT: number | string;
  FINE_RATE: number | string;
  MAX_FINE_PERCENT: number | string;
  MAX_LOAN_PER_CYCLE: number | string;
  MIN_SYSTEM_BUDGET: number | string;
  MAX_SINGLE_LOAN_AMOUNT: number | string;
}
