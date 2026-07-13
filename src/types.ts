export interface UserProfile {
  id: string;
  name: string;
  email: string;
  photoURL: string;
  createdAt: string;
}

export interface MemberPermissions {
  approveLoans: boolean;
  recordContributions: boolean;
  manageMembers: boolean;
  scheduleMeetings: boolean;
  manageInvestments: boolean;
}

export interface Chama {
  id: string;
  name: string;
  description: string;
  totalSavings: number;
  totalInvestments: number;
  totalLoans: number;
  frequency: "weekly" | "monthly" | "custom";
  contributionAmount: number;
  currency: string;
  createdBy: string;
  createdAt: string;
  logoURL?: string;
  sharePrice?: number; // per unit share price, e.g. 2000
}

export interface Member {
  id: string; // matches userId
  userId: string;
  name: string;
  email: string;
  photoURL: string;
  role: "super_admin" | "chairperson" | "secretary" | "vice_chairperson" | "treasurer" | "member";
  joinedAt: string;
  isPending?: boolean;
  phoneNumber?: string;
  permissions?: MemberPermissions;
}

export interface Contribution {
  id: string;
  userId: string;
  memberName: string;
  amount: number;
  date: string;
  type: "savings" | "investment" | "loan_repayment" | "fine" | "other";
  status: "pending" | "approved" | "rejected";
  notes: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface Investment {
  id: string;
  title: string;
  description: string;
  amountInvested: number;
  currentValue: number;
  status: "active" | "matured" | "liquidated";
  dateAcquired: string;
  expectedReturn: string;
  notes: string;
  createdBy: string;
}

export interface Loan {
  id: string;
  userId: string;
  memberName: string;
  amount: number;
  interestRate: number; // e.g., 5 for 5% flat
  repaymentTermMonths: number;
  amountRepaid: number;
  status: "pending" | "approved" | "active" | "repaid" | "rejected";
  dateRequested: string;
  dueDate: string;
  approvedBy?: string;
}
