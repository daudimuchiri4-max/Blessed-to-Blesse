import React, { useState, useEffect } from "react";
import { collection, onSnapshot, query, addDoc, doc, updateDoc, increment, getDocs, where, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Chama, Contribution, Member, Loan } from "../types";
import { Plus, Check, X, Filter, DollarSign, Wallet, Calendar, AlertCircle, FileText, CheckCircle, ChevronLeft, ChevronRight, Clock, Sparkles, Edit2, Trash2, Search, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { createChamaNotification } from "../utils/notifications";

// Helper: Get all due dates in a given month
const getDueDatesInMonth = (year: number, month: number, createdAtStr: string, frequency: string) => {
  const dates: Date[] = [];
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0); // Last day of month
  const creationDate = createdAtStr ? new Date(createdAtStr) : new Date(2026, 0, 1);
  
  if (frequency === "weekly") {
    const dueDayOfWeek = isNaN(creationDate.getTime()) ? 0 : creationDate.getDay();
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === dueDayOfWeek) {
        dates.push(new Date(d));
      }
    }
  } else if (frequency === "monthly") {
    const dueDayOfMonth = isNaN(creationDate.getTime()) ? 1 : creationDate.getDate();
    const maxDays = endDate.getDate();
    const targetDay = dueDayOfMonth > maxDays ? maxDays : dueDayOfMonth;
    const d = new Date(year, month, targetDay);
    if (d >= startDate && d <= endDate) {
      dates.push(d);
    }
  } else {
    // custom (fortnightly = 14 days)
    if (!isNaN(creationDate.getTime())) {
      const baseDate = new Date(creationDate.getFullYear(), creationDate.getMonth(), creationDate.getDate());
      const firstOfMonth = new Date(year, month, 1);
      const lastOfMonth = new Date(year, month + 1, 0);
      
      const diffTime = firstOfMonth.getTime() - baseDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      let k = Math.floor(diffDays / 14);
      if (k < 0) k = 0;
      
      let currentOccur = new Date(baseDate.getTime() + k * 14 * 24 * 60 * 60 * 1000);
      while (currentOccur <= lastOfMonth) {
        if (currentOccur >= firstOfMonth) {
          dates.push(new Date(currentOccur));
        }
        k++;
        currentOccur = new Date(baseDate.getTime() + k * 14 * 24 * 60 * 60 * 1000);
      }
    } else {
      dates.push(new Date(year, month, 1));
      dates.push(new Date(year, month, 15));
    }
  }
  return dates;
};

// Helper: Check if a date is a due date
const isDueDate = (date: Date, createdAtStr: string, frequency: string) => {
  const creationDate = createdAtStr ? new Date(createdAtStr) : new Date(2026, 0, 1);
  if (isNaN(creationDate.getTime())) return false;

  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const c = new Date(creationDate.getFullYear(), creationDate.getMonth(), creationDate.getDate());

  if (d < c) return false;

  if (frequency === "weekly") {
    return d.getDay() === c.getDay();
  } else if (frequency === "monthly") {
    const targetDay = c.getDate();
    const lastDayOfDMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const dueDay = targetDay > lastDayOfDMonth ? lastDayOfDMonth : targetDay;
    return d.getDate() === dueDay;
  } else {
    const diffTime = d.getTime() - c.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays % 14 === 0;
  }
};

// Helper: Calculate 42-day calendar grid
const getDaysInMonthGrid = (year: number, month: number) => {
  const firstDayIndex = new Date(year, month, 1).getDay();
  const numDays = new Date(year, month + 1, 0).getDate();
  const grid = [];
  
  const prevMonthNumDays = new Date(year, month, 0).getDate();
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    grid.push({
      day: prevMonthNumDays - i,
      month: month === 0 ? 11 : month - 1,
      year: month === 0 ? year - 1 : year,
      isCurrentMonth: false
    });
  }
  
  for (let i = 1; i <= numDays; i++) {
    grid.push({
      day: i,
      month: month,
      year: year,
      isCurrentMonth: true
    });
  }
  
  const remaining = 42 - grid.length;
  for (let i = 1; i <= remaining; i++) {
    grid.push({
      day: i,
      month: month === 11 ? 0 : month + 1,
      year: month === 11 ? year + 1 : year,
      isCurrentMonth: false
    });
  }
  
  return grid;
};

// Helper: Determine member payment status for a specific due date
const getMemberPaymentStatusForDueDate = (
  memberId: string, 
  dueDate: Date, 
  frequency: string, 
  contributions: Contribution[]
) => {
  const start = new Date(dueDate);
  const end = new Date(dueDate);
  end.setHours(23, 59, 59, 999);
  
  if (frequency === "weekly") {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else if (frequency === "monthly") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - 13);
    start.setHours(0, 0, 0, 0);
  }

  const memberContribs = contributions.filter(c => {
    const isSameUser = c.userId === memberId;
    if (!isSameUser) return false;
    
    const cDate = new Date(c.date);
    return cDate >= start && cDate <= end;
  });

  if (memberContribs.length === 0) {
    return { status: "unpaid" as const, amount: 0, contrib: null };
  }

  const approved = memberContribs.find(c => c.status === "approved");
  if (approved) {
    return { status: "approved" as const, amount: approved.amount, contrib: approved };
  }

  const pending = memberContribs.find(c => c.status === "pending");
  if (pending) {
    return { status: "pending" as const, amount: pending.amount, contrib: pending };
  }

  return { status: "rejected" as const, amount: memberContribs[0].amount, contrib: memberContribs[0] };
};

interface ContributionsTabProps {
  chama: Chama;
  currentUserId: string;
  memberRole: Member["role"] | null;
  currentUserDisplayName: string;
}

export default function ContributionsTab({ chama, currentUserId, memberRole, currentUserDisplayName }: ContributionsTabProps) {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);

  // Helper: Get total approved savings contributions of a member
  const getMemberApprovedSavings = (userId: string) => {
    return contributions
      .filter((c) => (c.userId === userId) && c.type === "savings" && c.status === "approved")
      .reduce((sum, c) => sum + c.amount, 0);
  };

  // Filtered list of automatic deductions (debits) from shares
  const autoDeductions = contributions.filter((c) => {
    const isAuto = c.notes && c.notes.includes("Automatic deduction") && c.amount < 0;
    if (!isAuto) return false;
    if (memberRole === "member" && c.userId !== currentUserId) {
      return false;
    }
    return true;
  });
  
  // Filter states
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchMemberQuery, setSearchMemberQuery] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Sub-tab selection: calendar vs ledger
  const [activeSubTab, setActiveSubTab] = useState<"calendar" | "ledger">("calendar");

  // Calendar view states
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth());
  const [selectedDueDate, setSelectedDueDate] = useState<Date | null>(null);

  // Sync selected due date when viewed month/year changes
  useEffect(() => {
    const dueDates = getDueDatesInMonth(currentYear, currentMonth, chama.createdAt, chama.frequency);
    if (dueDates.length > 0) {
      const today = new Date();
      // Try to find the closest due date to today in the viewed month, or default to the first one
      const closest = dueDates.find(d => d.getDate() >= today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()) || dueDates[0];
      setSelectedDueDate(closest);
    } else {
      setSelectedDueDate(null);
    }
  }, [currentYear, currentMonth, chama.createdAt, chama.frequency]);

  // Month navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  // Modal / Form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<Contribution["type"]>("savings");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit/delete states
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedContribToEdit, setSelectedContribToEdit] = useState<Contribution | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editType, setEditType] = useState<Contribution["type"]>("savings");
  const [editStatus, setEditStatus] = useState<Contribution["status"]>("pending");
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const handleOpenEditModal = (contrib: Contribution) => {
    setSelectedContribToEdit(contrib);
    setEditAmount(contrib.amount.toString());
    setEditType(contrib.type);
    setEditStatus(contrib.status);
    setEditDate(new Date(contrib.date).toISOString().split("T")[0]);
    setEditNotes(contrib.notes || "");
    setShowEditModal(true);
    setError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContribToEdit) return;

    const parsedAmount = parseFloat(editAmount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      setError("Please enter a valid amount.");
      return;
    }

    setSavingEdit(true);
    setError(null);

    try {
      const oldStatus = selectedContribToEdit.status;
      const oldAmount = selectedContribToEdit.amount;
      const oldType = selectedContribToEdit.type;

      // 1. Revert effect of the OLD contribution if it was "approved"
      if (oldStatus === "approved") {
        // Decrement chama total savings
        await updateDoc(doc(db, "chamas", chama.id), {
          totalSavings: increment(-oldAmount),
        });

        // Revert loan repayment effect if type was loan_repayment
        if (oldType === "loan_repayment") {
          const loansRef = collection(db, "chamas", chama.id, "loans");
          const q = query(loansRef, where("userId", "==", selectedContribToEdit.userId));
          const loansSnap = await getDocs(q);

          for (const loanDoc of loansSnap.docs) {
            const loanData = loanDoc.data();
            const repaid = loanData.amountRepaid || 0;
            const newRepaid = Math.max(0, repaid - oldAmount);
            const totalPayable = loanData.amount * (1 + loanData.interestRate / 100);

            await updateDoc(doc(db, "chamas", chama.id, "loans", loanDoc.id), {
              amountRepaid: newRepaid,
              status: newRepaid >= totalPayable ? "repaid" : "active",
            });

            // Adjust outstanding loans tracking
            await updateDoc(doc(db, "chamas", chama.id), {
              totalLoans: increment(oldAmount),
            });
            break; // assume single active/recently-repaid loan
          }
        }
      }

      // 2. Apply effect of the NEW contribution if status is "approved"
      if (editStatus === "approved") {
        // Increment chama total savings
        await updateDoc(doc(db, "chamas", chama.id), {
          totalSavings: increment(parsedAmount),
        });

        // Apply loan repayment if new type is loan_repayment
        if (editType === "loan_repayment") {
          const loansRef = collection(db, "chamas", chama.id, "loans");
          const q = query(loansRef, where("userId", "==", selectedContribToEdit.userId), where("status", "==", "active"));
          const loansSnap = await getDocs(q);

          if (!loansSnap.empty) {
            const activeLoanDoc = loansSnap.docs[0];
            const activeLoanData = activeLoanDoc.data();
            const repaid = activeLoanData.amountRepaid || 0;
            const newRepaid = repaid + parsedAmount;
            const totalPayable = activeLoanData.amount * (1 + activeLoanData.interestRate / 100);

            await updateDoc(doc(db, "chamas", chama.id, "loans", activeLoanDoc.id), {
              amountRepaid: increment(parsedAmount),
              status: newRepaid >= totalPayable ? "repaid" : "active",
            });

            // Decrement outstanding loans tracking
            await updateDoc(doc(db, "chamas", chama.id), {
              totalLoans: increment(-parsedAmount),
            });
          }
        }
      }

      // 3. Update the contribution in Firestore
      const updateData: Partial<Contribution> = {
        amount: parsedAmount,
        type: editType,
        status: editStatus,
        date: new Date(editDate).toISOString(),
        notes: editNotes,
        approvedBy: editStatus === "approved" ? currentUserId : undefined,
        approvedAt: editStatus === "approved" ? new Date().toISOString() : undefined,
      };

      await updateDoc(doc(db, "chamas", chama.id, "contributions", selectedContribToEdit.id), updateData);

      // 4. Create and send notifications to the member
      await createChamaNotification(chama.id, {
        title: "Contribution Amended",
        message: `Your contribution of ${oldAmount.toLocaleString()} ${chama.currency} (${oldType}) has been updated by the treasurer to ${parsedAmount.toLocaleString()} ${chama.currency} (${editType}) with status "${editStatus}".`,
        type: "warning",
        userId: selectedContribToEdit.userId,
        link: "contributions",
      });

      setShowEditModal(false);
      setSelectedContribToEdit(null);
    } catch (err: any) {
      console.error("Failed to update contribution:", err);
      setError(err.message || "Failed to save changes.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteContribution = async (contrib: Contribution) => {
    if (!window.confirm(`Are you sure you want to delete ${contrib.memberName}'s contribution of ${contrib.amount.toLocaleString()} ${chama.currency}? This action is irreversible and will adjust all balances.`)) {
      return;
    }

    try {
      // 1. If it was approved, revert totals
      if (contrib.status === "approved") {
        await updateDoc(doc(db, "chamas", chama.id), {
          totalSavings: increment(-contrib.amount),
        });

        if (contrib.type === "loan_repayment") {
          const loansRef = collection(db, "chamas", chama.id, "loans");
          const q = query(loansRef, where("userId", "==", contrib.userId));
          const loansSnap = await getDocs(q);

          for (const loanDoc of loansSnap.docs) {
            const loanData = loanDoc.data();
            const repaid = loanData.amountRepaid || 0;
            const newRepaid = Math.max(0, repaid - contrib.amount);
            const totalPayable = loanData.amount * (1 + loanData.interestRate / 100);

            await updateDoc(doc(db, "chamas", chama.id, "loans", loanDoc.id), {
              amountRepaid: newRepaid,
              status: newRepaid >= totalPayable ? "repaid" : "active",
            });

            await updateDoc(doc(db, "chamas", chama.id), {
              totalLoans: increment(contrib.amount),
            });
            break;
          }
        }
      }

      // 2. Delete the contribution document
      await deleteDoc(doc(db, "chamas", chama.id, "contributions", contrib.id));

      // 3. Notify the member of the deletion
      await createChamaNotification(chama.id, {
        title: "Contribution Removed",
        message: `Your contribution of ${contrib.amount.toLocaleString()} ${chama.currency} (${contrib.type}) dated ${new Date(contrib.date).toLocaleDateString()} has been removed by the treasurer.`,
        type: "alert",
        userId: contrib.userId,
        link: "contributions",
      });

    } catch (err) {
      console.error("Error deleting contribution:", err);
      alert("Failed to delete contribution. Please try again.");
    }
  };
  
  // Member selection states
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState(currentUserId);

  // Only Treasurer can approve contributions
  const isTreasurer = memberRole === "treasurer";

  // Real-time subscribe to members list
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "chamas", chama.id, "members"),
      (snapshot) => {
        const list: Member[] = [];
        snapshot.forEach((doc) => {
          const m = { id: doc.id, ...doc.data() } as Member;
          if (m.role !== "super_admin" && m.email !== "superadmin@chama.com") {
            list.push(m);
          }
        });
        setMembers(list);
      },
      (error) => {
        console.error("Error loading members in ContributionsTab:", error);
      }
    );

    return () => unsubscribe();
  }, [chama.id]);

  // Real-time subscribe to contributions
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "chamas", chama.id, "contributions"),
      (snapshot) => {
        const list: Contribution[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Contribution);
        });
        // Sort by date descending
        list.sort((a, b) => b.date.localeCompare(a.date));
        setContributions(list);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading contributions:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [chama.id]);

  // Effect to automatically run 10th of the month deductions
  useEffect(() => {
    if (loading || members.length === 0 || contributions.length === 0 || !chama.contributionAmount || chama.frequency !== "monthly") {
      return;
    }

    const scanAndRunDeductions = async () => {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();

      // Scan from the year the Chama was created, up to current year/month
      const creationDate = chama.createdAt ? new Date(chama.createdAt) : new Date(2026, 0, 1);
      const startYear = isNaN(creationDate.getTime()) ? 2026 : creationDate.getFullYear();
      const startMonth = isNaN(creationDate.getTime()) ? 0 : creationDate.getMonth();

      let y = startYear;
      let m = startMonth;

      while (y < currentYear || (y === currentYear && m <= currentMonth)) {
        const tenthOfThatMonth = new Date(y, m, 10);
        
        // If today is on or past the 10th of this month, we verify compliance
        if (today >= tenthOfThatMonth) {
          for (const member of members) {
            const memberId = member.userId || member.id;
            
            // Calculate total standard positive savings contributions in this month
            const totalPaidInMonth = contributions
              .filter((c) => {
                if (c.userId !== memberId || c.status !== "approved" || c.amount <= 0) return false;
                const cDate = new Date(c.date);
                return cDate.getFullYear() === y && cDate.getMonth() === m && c.type === "savings";
              })
              .reduce((sum, c) => sum + c.amount, 0);

            const shortfall = chama.contributionAmount - totalPaidInMonth;

            if (shortfall > 0) {
              // Check if we already processed an automatic deduction for this month
              const hasDeducted = contributions.some((c) => {
                if (c.userId !== memberId || c.status !== "approved" || c.amount >= 0) return false;
                const cDate = new Date(c.date);
                return cDate.getFullYear() === y && cDate.getMonth() === m && c.notes.includes("Automatic deduction from shares");
              });

              if (!hasDeducted) {
                // Determine available savings
                const currentSavings = getMemberApprovedSavings(memberId);

                // Deduct if they have any savings to cover the shortfall (or up to their total savings)
                if (currentSavings > 0) {
                  const deductionAmount = Math.min(shortfall, currentSavings);
                  try {
                    const timestampStr = new Date(y, m, 10, 12, 0, 0).toISOString();
                    
                    // 1. Create Negative Contribution (Deduction from Shares)
                    const deductionData = {
                      userId: memberId,
                      memberName: member.name,
                      amount: -deductionAmount,
                      date: timestampStr,
                      type: "savings" as const,
                      status: "approved" as const,
                      notes: `Automatic deduction from shares due to missed monthly contribution [${y}-${m + 1}]`,
                      approvedBy: "system",
                      approvedAt: new Date().toISOString()
                    };
                    await addDoc(collection(db, "chamas", chama.id, "contributions"), deductionData);

                    // 2. Create Positive Contribution (Covered Monthly Payment)
                    const coverageData = {
                      userId: memberId,
                      memberName: member.name,
                      amount: deductionAmount,
                      date: timestampStr,
                      type: "other" as const, // Use 'other' so it doesn't double-count as standard savings, but satisfies compliance
                      status: "approved" as const,
                      notes: `Monthly contribution covered by automatic share deduction [${y}-${m + 1}]`,
                      approvedBy: "system",
                      approvedAt: new Date().toISOString()
                    };
                    await addDoc(collection(db, "chamas", chama.id, "contributions"), coverageData);

                    // Send system notifications
                    await createChamaNotification(chama.id, {
                      title: "Automated Share Deduction",
                      message: `${member.name}'s missed monthly contribution was automatically deducted from their shares: -${deductionAmount.toLocaleString()} ${chama.currency}.`,
                      type: "warning",
                      link: "contributions",
                    });

                    await createChamaNotification(chama.id, {
                      title: "Automated Share Deduction",
                      message: `Your missed monthly contribution was automatically deducted from your shares: -${deductionAmount.toLocaleString()} ${chama.currency}.`,
                      type: "alert",
                      userId: memberId,
                      link: "contributions",
                    });

                    console.log(`Successfully processed automatic deduction of ${deductionAmount} for ${member.name} for ${y}-${m + 1}`);
                  } catch (err) {
                    console.error("Error executing automatic share deduction:", err);
                  }
                }
              }
            }
          }
        }

        // Advance to next month
        m++;
        if (m > 11) {
          m = 0;
          y++;
        }
      }
    };

    scanAndRunDeductions();
  }, [loading, members, contributions, chama.id, chama.contributionAmount, chama.frequency, chama.createdAt]);

  const handleRecordContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid positive amount.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const selectedMember = members.find((m) => m.id === selectedMemberId);
      const contributionData: Omit<Contribution, "id"> = {
        userId: selectedMember ? (selectedMember.userId || selectedMember.id) : currentUserId,
        memberName: selectedMember ? selectedMember.name : currentUserDisplayName,
        amount: parsedAmount,
        date: new Date(date).toISOString(),
        type,
        status: "pending",
        notes,
      };

      await addDoc(collection(db, "chamas", chama.id, "contributions"), contributionData);

      await createChamaNotification(chama.id, {
        title: "Contribution Logged",
        message: `${contributionData.memberName} submitted a contribution of ${parsedAmount.toLocaleString()} ${chama.currency} (${type}) for verification.`,
        type: "info",
        link: "contributions",
      });

      // Reset
      setAmount("");
      setType("savings");
      setDate(new Date().toISOString().split("T")[0]);
      setNotes("");
      setSelectedMemberId(currentUserId);
      setShowAddModal(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to record contribution.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (contrib: Contribution) => {
    try {
      // 1. Update contribution status to approved
      await updateDoc(doc(db, "chamas", chama.id, "contributions", contrib.id), {
        status: "approved",
        approvedBy: currentUserId,
        approvedAt: new Date().toISOString(),
      });

      // 2. Increment Chama's totalSavings
      await updateDoc(doc(db, "chamas", chama.id), {
        totalSavings: increment(contrib.amount),
      });

      // Send a targeted notification to the contributor
      await createChamaNotification(chama.id, {
        title: "Contribution Approved",
        message: `Your contribution of ${contrib.amount.toLocaleString()} ${chama.currency} (${contrib.type}) has been approved by the treasurer.`,
        type: "success",
        userId: contrib.userId,
        link: "contributions",
      });

      // Send a general notification to all members about group savings updating
      await createChamaNotification(chama.id, {
        title: "Savings Pool Updated",
        message: `Verified savings contribution of ${contrib.amount.toLocaleString()} ${chama.currency} from ${contrib.memberName} was added to the cooperative pool.`,
        type: "info",
        link: "contributions",
      });

      // 3. If loan repayment, find their active loan and pay it down
      if (contrib.type === "loan_repayment") {
        const loansRef = collection(db, "chamas", chama.id, "loans");
        const q = query(loansRef, where("userId", "==", contrib.userId), where("status", "==", "active"));
        const loansSnap = await getDocs(q);

        if (!loansSnap.empty) {
          const activeLoanDoc = loansSnap.docs[0];
          const activeLoan = { id: activeLoanDoc.id, ...activeLoanDoc.data() } as Loan;
          
          const newRepaid = activeLoan.amountRepaid + contrib.amount;
          const totalPayable = activeLoan.amount * (1 + activeLoan.interestRate / 100);

          await updateDoc(doc(db, "chamas", chama.id, "loans", activeLoan.id), {
            amountRepaid: increment(contrib.amount),
            status: newRepaid >= totalPayable ? "repaid" : "active",
          });

          // Decrement outstanding Chama loan tracking
          await updateDoc(doc(db, "chamas", chama.id), {
            totalLoans: increment(-contrib.amount),
          });
        }
      }
    } catch (err) {
      console.error("Error approving contribution:", err);
    }
  };

  const handleReject = async (contrib: Contribution) => {
    try {
      await updateDoc(doc(db, "chamas", chama.id, "contributions", contrib.id), {
        status: "rejected",
        approvedBy: currentUserId,
        approvedAt: new Date().toISOString(),
      });

      await createChamaNotification(chama.id, {
        title: "Contribution Declined",
        message: `Your contribution of ${contrib.amount.toLocaleString()} ${chama.currency} (${contrib.type}) was rejected. Please contact your treasurer for details.`,
        type: "alert",
        userId: contrib.userId,
        link: "contributions",
      });
    } catch (err) {
      console.error("Error rejecting contribution:", err);
    }
  };

  const filteredContributions = contributions.filter((c) => {
    // Regular members can only view their own contributions
    if (memberRole === "member" && c.userId !== currentUserId) {
      return false;
    }
    const matchesType = typeFilter === "all" || c.type === typeFilter;
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    
    // Member name search filter (case-insensitive)
    const matchesSearch = !(searchMemberQuery || "").trim() || 
      (c.memberName && c.memberName.toLowerCase().includes((searchMemberQuery || "").toLowerCase()));
      
    // Date range filter
    let matchesDateRange = true;
    if (startDate) {
      const sDate = new Date(startDate);
      const cDate = new Date(c.date);
      if (!isNaN(sDate.getTime()) && !isNaN(cDate.getTime())) {
        const sTime = new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate()).getTime();
        const cTime = new Date(cDate.getFullYear(), cDate.getMonth(), cDate.getDate()).getTime();
        if (cTime < sTime) {
          matchesDateRange = false;
        }
      }
    }
    if (endDate) {
      const eDate = new Date(endDate);
      const cDate = new Date(c.date);
      if (!isNaN(eDate.getTime()) && !isNaN(cDate.getTime())) {
        const eTime = new Date(eDate.getFullYear(), eDate.getMonth(), eDate.getDate()).getTime();
        const cTime = new Date(cDate.getFullYear(), cDate.getMonth(), cDate.getDate()).getTime();
        if (cTime > eTime) {
          matchesDateRange = false;
        }
      }
    }
    
    return matchesType && matchesStatus && matchesSearch && matchesDateRange;
  });

  return (
    <div className="space-y-6 font-sans">
      
      {/* Header and Filter Row */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white">Group Ledger Contributions</h3>
          <p className="text-xs text-slate-500">Record payments, manage statements, and authorize deposits.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
        >
          <Plus className="w-4 h-4 stroke-[3]" /> Record Contribution
        </button>
      </div>

      {/* 10th of Month Automated Share Deduction Policy Notice */}
      {chama.frequency === "monthly" && chama.contributionAmount > 0 && (
        <div className="p-4 bg-slate-950 border border-slate-900 rounded-2xl flex items-start gap-3.5 text-xs text-slate-400">
          <Sparkles className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-200">10th Monthly Auto-Deduction Rule is ACTIVE</span>
              <span className="text-[9px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase">
                COOPERATIVE LAW ENFORCED
              </span>
            </div>
            <p className="leading-relaxed">
              If members miss their monthly agreed savings contribution (<strong>{chama.contributionAmount.toLocaleString()} {chama.currency}</strong>) by the <strong>10th of any month</strong>, the outstanding shortfall will be automatically deducted from their existing shares (savings pool) and recorded as a compliant transaction.
            </p>
          </div>
        </div>
      )}

      {/* Sub-tabs switcher */}
      <div className="flex border-b border-slate-900 gap-6">
        <button
          type="button"
          onClick={() => setActiveSubTab("calendar")}
          className={`pb-3 text-sm font-semibold tracking-wide transition-colors relative cursor-pointer ${
            activeSubTab === "calendar" ? "text-emerald-400 font-bold" : "text-slate-400 hover:text-white"
          }`}
        >
          📅 Compliance Calendar
          {activeSubTab === "calendar" && (
            <motion.div layoutId="activeSubTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab("ledger")}
          className={`pb-3 text-sm font-semibold tracking-wide transition-colors relative cursor-pointer ${
            activeSubTab === "ledger" ? "text-emerald-400 font-bold" : "text-slate-400 hover:text-white"
          }`}
        >
          📊 Contributions Ledger
          {activeSubTab === "ledger" && (
            <motion.div layoutId="activeSubTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
          )}
        </button>
      </div>

      {/* Dynamic Views */}
      {activeSubTab === "calendar" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Side: Interactive Calendar Grid (7 cols) */}
          <div className="lg:col-span-7 p-6 bg-slate-900/40 border border-slate-900 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                  Payment Schedule
                </h4>
                <p className="text-[11px] text-slate-500">
                  Select highlighted due dates to inspect member compliance.
                </p>
              </div>
              
              {/* Month Navigator */}
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-850 p-1 rounded-xl self-start sm:self-auto">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1.5 hover:bg-slate-900 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono font-bold text-white px-2 min-w-[110px] text-center">
                  {new Date(currentYear, currentMonth).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                </span>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1.5 hover:bg-slate-900 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Frequency Explainer Banner */}
            <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between text-xs text-emerald-400/90 font-sans gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Frequency Settings: <strong className="uppercase">{chama.frequency}</strong> • Target Contribution: <strong>{chama.contributionAmount.toLocaleString()} {chama.currency}</strong>
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">
                Created {new Date(chama.createdAt).toLocaleDateString()}
              </span>
            </div>

            {/* Calendar Grid */}
            <div className="space-y-2">
              {/* Weekday Labels */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((day) => (
                  <span key={day} className="text-[10px] font-mono font-bold text-slate-500 py-1">
                    {day}
                  </span>
                ))}
              </div>

              {/* Day Cells */}
              <div className="grid grid-cols-7 gap-1">
                {getDaysInMonthGrid(currentYear, currentMonth).map((gridDay, idx) => {
                  const cellDate = new Date(gridDay.year, gridDay.month, gridDay.day);
                  const isCellDue = isDueDate(cellDate, chama.createdAt, chama.frequency);
                  const isSelected = selectedDueDate && 
                    selectedDueDate.getDate() === gridDay.day && 
                    selectedDueDate.getMonth() === gridDay.month && 
                    selectedDueDate.getFullYear() === gridDay.year;
                    
                  // Calculate compliance for this day if it is a due date
                  let statusSummary = null;
                  if (isCellDue && members.length > 0) {
                    const visibleMembersForCal = memberRole === "member"
                      ? members.filter(m => m.id === currentUserId || m.userId === currentUserId)
                      : members;
                    const stats = visibleMembersForCal.map(m => getMemberPaymentStatusForDueDate(m.id, cellDate, chama.frequency, contributions));
                    const approvedCount = stats.filter(s => s.status === "approved").length;
                    const pendingCount = stats.filter(s => s.status === "pending").length;
                    
                    if (approvedCount === visibleMembersForCal.length) {
                      statusSummary = "full";
                    } else if (approvedCount + pendingCount > 0) {
                      statusSummary = "partial";
                    } else {
                      statusSummary = "none";
                    }
                  }

                  const isToday = new Date().getDate() === gridDay.day && 
                    new Date().getMonth() === gridDay.month && 
                    new Date().getFullYear() === gridDay.year;

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={!isCellDue}
                      onClick={() => isCellDue && setSelectedDueDate(cellDate)}
                      className={`h-14 p-1.5 rounded-xl flex flex-col justify-between items-start transition-all relative group text-left ${
                        !gridDay.isCurrentMonth ? "opacity-25" : "opacity-100"
                      } ${
                        isCellDue 
                          ? "border border-dashed border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 cursor-pointer" 
                          : "border border-transparent bg-slate-950/20"
                      } ${
                        isSelected ? "ring-2 ring-emerald-500/70 border-solid" : ""
                      } ${
                        isToday ? "bg-slate-900 border-slate-850" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-[10px] font-mono font-bold ${
                          isToday ? "text-emerald-400 font-extrabold" : "text-slate-400"
                        }`}>
                          {gridDay.day}
                        </span>
                        
                        {isCellDue && (
                          <span className="text-[8px] font-mono font-extrabold text-emerald-500 leading-none">DUE</span>
                        )}
                      </div>

                      {/* Day compliance indicators */}
                      {isCellDue && statusSummary && (
                        <div className="w-full flex items-center justify-between gap-1.5 pt-1">
                          <div className="h-1 flex-1 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                statusSummary === "full" ? "bg-emerald-500 w-full" :
                                statusSummary === "partial" ? "bg-amber-500 w-1/2" : "bg-red-500 w-1"
                              }`} 
                            />
                          </div>
                          
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            statusSummary === "full" ? "bg-emerald-500" :
                            statusSummary === "partial" ? "bg-amber-500" : "bg-red-500"
                          }`} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Side: Compliance Checklist Detail Panel (5 cols) */}
          <div className="lg:col-span-5 p-6 bg-slate-900/40 border border-slate-900 rounded-2xl space-y-4">
            <div className="border-b border-slate-900 pb-3">
              <h4 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-400" /> Compliance Details
              </h4>
              <p className="text-[11px] text-slate-500 mt-1">
                {selectedDueDate ? (
                  <>Period ending on <strong className="text-slate-300 font-mono">{selectedDueDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</strong></>
                ) : (
                  "Select a due date on the calendar to audit payment records."
                )}
              </p>
            </div>

            {selectedDueDate ? (() => {
              const visibleMembersList = memberRole === "member"
                ? members.filter(m => m.id === currentUserId || m.userId === currentUserId)
                : members;
              const stats = visibleMembersList.map(m => {
                const pay = getMemberPaymentStatusForDueDate(m.id, selectedDueDate, chama.frequency, contributions);
                return { member: m, ...pay };
              });
              
              const paidCount = stats.filter(s => s.status === "approved").length;
              const pendingCount = stats.filter(s => s.status === "pending").length;
              const complianceRate = visibleMembersList.length > 0 ? (paidCount / visibleMembersList.length) * 100 : 0;

              return (
                <div className="space-y-4">
                  {/* Performance stats header */}
                  <div className="p-4 bg-slate-950 border border-slate-850 rounded-2xl flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-[9px] font-mono text-slate-500 uppercase">Compliance Rate</p>
                      <p className="text-xl font-extrabold font-mono text-emerald-400">{complianceRate.toFixed(0)}%</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {paidCount} of {visibleMembersList.length} Paid
                        {pendingCount > 0 && <span className="text-amber-400"> ({pendingCount} Pending)</span>}
                      </p>
                    </div>

                    {/* Circular compliance gauge */}
                    <div className="w-14 h-14 relative flex items-center justify-center shrink-0">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="28" cy="28" r="24" className="stroke-slate-800" strokeWidth="4" fill="transparent" />
                        <circle 
                          cx="28" 
                          cy="28" 
                          r="24" 
                          className="stroke-emerald-500" 
                          strokeWidth="4" 
                          fill="transparent" 
                          strokeDasharray={`${2 * Math.PI * 24}`} 
                          strokeDashoffset={`${2 * Math.PI * 24 * (1 - complianceRate / 100)}`}
                        />
                      </svg>
                      <span className="absolute text-[10px] font-mono font-bold text-white">{paidCount}/{visibleMembersList.length}</span>
                    </div>
                  </div>

                  {/* Checklist of Members */}
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {stats.map(({ member, status, amount, contrib }) => (
                      <div 
                        key={member.id} 
                        className="p-3 bg-slate-950/60 border border-slate-900 rounded-xl flex items-center justify-between gap-3 text-xs hover:border-slate-800 transition-all"
                      >
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-200">{member.name}</p>
                          <p className="text-[9px] font-mono text-slate-500 uppercase">
                            {member.role === "super_admin" ? "Super Admin" : member.role === "treasurer" ? "Treasurer" : member.role === "secretary" ? "Secretary" : "Member"}
                          </p>
                        </div>

                        <div className="text-right flex flex-col items-end">
                          <div className="flex items-center gap-1.5">
                            {status === "approved" ? (
                              <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 px-1.5 py-0.5 rounded uppercase">
                                <Check className="w-3 h-3 stroke-[3]" /> Paid
                              </span>
                            ) : status === "pending" ? (
                              <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-amber-400 bg-amber-500/5 border border-amber-500/10 px-1.5 py-0.5 rounded uppercase animate-pulse">
                                <Clock className="w-3 h-3" /> Pending Review
                              </span>
                            ) : status === "rejected" ? (
                              <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-red-400 bg-red-500/5 border border-red-500/10 px-1.5 py-0.5 rounded uppercase">
                                <X className="w-3 h-3" /> Rejected
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-slate-500 bg-slate-950 border border-slate-855 px-1.5 py-0.5 rounded uppercase">
                                <AlertCircle className="w-3 h-3" /> Unpaid
                              </span>
                            )}
                          </div>
                          {amount > 0 && (
                            <span className="text-[9px] font-mono text-slate-400 mt-1">
                              {amount.toLocaleString()} {chama.currency} 
                              {contrib?.date && ` on ${new Date(contrib.date).toLocaleDateString()}`}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Administrative instructions helper */}
                  <div className="p-3.5 bg-slate-950 border border-slate-900 rounded-xl space-y-2 text-[10px] text-slate-400 font-sans">
                    <p className="font-bold text-slate-300 font-mono flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-500" /> Administrative Notice
                    </p>
                    <p className="leading-relaxed">
                      If a member has completed their bank or mobile money transfer but shows as <strong>"Pending Review"</strong>, the group Treasurer must navigate to the <strong>"Contributions Ledger"</strong> sub-tab to inspect and approve their deposit receipt.
                    </p>
                  </div>
                </div>
              );
            })() : (
              <div className="py-12 text-center text-slate-500 text-xs font-mono space-y-2">
                <Calendar className="w-8 h-8 mx-auto text-slate-800 animate-pulse" />
                <p>No due dates fall in this month.</p>
              </div>
            )}
          </div>

        </div>
      ) : (
        <>
          {/* Filter and Overview Stats */}
          <div className="p-5 bg-slate-900/40 border border-slate-900 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-emerald-500" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Ledger Filter & Audit Controls
                </h4>
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                Showing <strong className="text-emerald-400">{filteredContributions.length}</strong> of <strong className="text-slate-300">{contributions.length}</strong> transactions
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Member Name Search */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-slate-400 uppercase font-semibold">Search Member</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
                    <Search className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="text"
                    value={searchMemberQuery}
                    onChange={(e) => setSearchMemberQuery(e.target.value)}
                    placeholder="Search by name..."
                    className="w-full bg-slate-950 border border-slate-850 hover:border-slate-800 focus:border-emerald-500/50 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Date From */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-slate-400 uppercase font-semibold">Date From</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 hover:border-slate-800 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition-all cursor-pointer"
                />
              </div>

              {/* Date To */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-slate-400 uppercase font-semibold">Date To</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 hover:border-slate-800 focus:border-emerald-500/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition-all cursor-pointer"
                />
              </div>

              {/* Select Controls (Type and Status together) */}
              <div className="grid grid-cols-2 gap-2 self-end">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-slate-400 uppercase font-semibold block">Type</label>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 hover:border-slate-800 focus:border-emerald-500/50 rounded-xl px-2 py-2 text-xs text-slate-300 focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="all">All Types</option>
                    <option value="savings">Savings</option>
                    <option value="investment">Investment Pool</option>
                    <option value="loan_repayment">Loan Repayments</option>
                    <option value="fine">Fines</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-slate-400 uppercase font-semibold block">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 hover:border-slate-800 focus:border-emerald-500/50 rounded-xl px-2 py-2 text-xs text-slate-300 focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending Verification</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Clear Filters bar if any are active */}
            {(typeFilter !== "all" || statusFilter !== "all" || searchMemberQuery || startDate || endDate) && (
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-500 font-mono">Active filters:</span>
                  {searchMemberQuery && (
                    <span className="text-[9px] font-mono bg-slate-950 px-2 py-1 border border-slate-850 rounded-lg text-slate-400 flex items-center gap-1">
                      Name: "{searchMemberQuery}"
                      <button onClick={() => setSearchMemberQuery("")} className="text-slate-500 hover:text-white cursor-pointer">&times;</button>
                    </span>
                  )}
                  {(startDate || endDate) && (
                    <span className="text-[9px] font-mono bg-slate-950 px-2 py-1 border border-slate-850 rounded-lg text-slate-400 flex items-center gap-1">
                      Date: {startDate || "Any"} to {endDate || "Any"}
                      <button onClick={() => { setStartDate(""); setEndDate(""); }} className="text-slate-500 hover:text-white cursor-pointer">&times;</button>
                    </span>
                  )}
                  {typeFilter !== "all" && (
                    <span className="text-[9px] font-mono bg-slate-950 px-2 py-1 border border-slate-850 rounded-lg text-slate-400 flex items-center gap-1">
                      Type: {typeFilter}
                      <button onClick={() => setTypeFilter("all")} className="text-slate-500 hover:text-white cursor-pointer">&times;</button>
                    </span>
                  )}
                  {statusFilter !== "all" && (
                    <span className="text-[9px] font-mono bg-slate-950 px-2 py-1 border border-slate-850 rounded-lg text-slate-400 flex items-center gap-1">
                      Status: {statusFilter}
                      <button onClick={() => setStatusFilter("all")} className="text-slate-500 hover:text-white cursor-pointer">&times;</button>
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setTypeFilter("all");
                    setStatusFilter("all");
                    setSearchMemberQuery("");
                    setStartDate("");
                    setEndDate("");
                  }}
                  className="flex items-center gap-1 text-[10px] font-mono text-emerald-500 hover:text-emerald-400 font-bold transition-colors cursor-pointer bg-emerald-500/5 hover:bg-emerald-500/10 px-2.5 py-1 border border-emerald-500/10 rounded-lg"
                >
                  <RotateCcw className="w-3 h-3" /> Clear All Filters
                </button>
              </div>
            )}
          </div>

          {/* Split screen: Main ledger table, and Treasurer's approvals sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Side: Contribution Ledger */}
            <div className="lg:col-span-8 p-6 bg-slate-900/40 border border-slate-900 rounded-2xl space-y-4">
              <h4 className="text-sm font-bold text-white font-mono uppercase tracking-wider border-b border-slate-900 pb-3">
                Transaction History
              </h4>

              {loading ? (
                <div className="space-y-3 py-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 bg-slate-900/20 border border-slate-900/60 animate-pulse rounded-xl" />
                  ))}
                </div>
              ) : filteredContributions.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs font-mono">
                  No matching transactions found.
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {filteredContributions.map((c) => (
                    <div 
                      key={c.id} 
                      className="p-4 bg-slate-950/40 border border-slate-900/80 rounded-xl flex items-center justify-between gap-4 hover:border-slate-800 hover:bg-slate-950/60 transition-all text-xs"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-200 truncate">{c.memberName}</span>
                          {c.userId === currentUserId && (
                            <span className="text-[9px] font-mono px-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded">YOU</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono uppercase flex items-center gap-1.5 flex-wrap">
                          <span>{c.type}</span>
                          <span>•</span>
                          <span>{new Date(c.date).toLocaleDateString()}</span>
                          {c.type === "savings" && c.status === "approved" && (
                            <>
                              <span>•</span>
                              <span className={`font-bold font-mono px-1 py-0.5 rounded border ${
                                c.amount >= 0 
                                  ? "text-emerald-400 bg-emerald-500/5 border-emerald-500/10" 
                                  : "text-amber-400 bg-amber-500/5 border-amber-500/10"
                              }`}>
                                {c.amount >= 0 ? "+" : ""}{(c.amount / (chama.sharePrice || 2000)).toFixed(1)} Shares
                              </span>
                            </>
                          )}
                          {c.notes && c.notes.includes("Automatic deduction") && (
                            <>
                              <span>•</span>
                              <span className="text-[8px] font-mono font-extrabold bg-amber-500/15 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase">
                                AUTO-DEDUCTED
                              </span>
                            </>
                          )}
                        </p>
                        {c.notes && (
                          <p className="text-[10px] text-slate-400 italic line-clamp-1">"{c.notes}"</p>
                        )}
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-3">
                        <div>
                          <p className={`font-mono font-extrabold text-sm ${c.amount < 0 ? "text-amber-400" : "text-white"}`}>
                            {c.amount >= 0 ? "+" : ""}{c.amount.toLocaleString()} {chama.currency}
                          </p>
                          <span className={`inline-block text-[9px] font-mono font-extrabold px-2 py-0.5 rounded uppercase mt-1 ${
                            c.status === "approved" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                            c.status === "pending" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : 
                            "bg-red-500/10 text-red-400 border border-red-500/20"
                          }`}>
                            {c.status}
                          </span>
                        </div>
                        {isTreasurer && (
                          <div className="flex flex-col gap-1.5 shrink-0 pl-2 border-l border-slate-850">
                            <button
                              onClick={() => handleOpenEditModal(c)}
                              title="Edit Contribution"
                              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 rounded-md transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteContribution(c)}
                              title="Delete Contribution"
                              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-red-400 rounded-md transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Side: Column Panels */}
            <div className="lg:col-span-4 space-y-6">
              {/* Treasurer Approval Panel */}
              <div className="p-6 bg-slate-900/40 border border-slate-900 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                  <h4 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                    Treasurer Approvals
                  </h4>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase font-bold">
                    {isTreasurer ? "TREASURER ACCESS" : "VIEW ONLY"}
                  </span>
                </div>

                {!isTreasurer ? (
                  <div className="p-4 bg-slate-950/20 border border-slate-900 rounded-xl space-y-2 text-xs text-slate-500 text-center">
                    <AlertCircle className="w-6 h-6 mx-auto text-slate-700" />
                    <p className="font-mono text-[10px]">APPROVALS RESTRICTED</p>
                    <p>Only the group Treasurer is authorized to verify and approve pending contributions.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-[11px] text-slate-400">
                      Incoming member payments waiting for bank statement verification. Verify receipts before approving.
                    </p>
                    
                    <div className="space-y-3">
                      {contributions.filter((c) => c.status === "pending").length === 0 ? (
                        <div className="p-4 bg-slate-950/30 border border-slate-900 rounded-xl text-center text-xs text-slate-500 space-y-2">
                          <CheckCircle className="w-6 h-6 mx-auto text-slate-700" />
                          <p className="font-mono text-[10px]">ALL CLEAR</p>
                          <p>No contributions waiting for approval.</p>
                        </div>
                      ) : (
                        contributions
                          .filter((c) => c.status === "pending")
                          .map((c) => (
                            <div key={c.id} className="p-3 bg-slate-950 border border-slate-850 rounded-xl space-y-2.5 text-xs">
                              <div>
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-200">{c.memberName}</span>
                                  <span className="font-mono text-emerald-400 font-extrabold">{c.amount.toLocaleString()} {chama.currency}</span>
                                </div>
                                <p className="text-[9px] text-slate-500 font-mono uppercase pt-0.5">{c.type} • {new Date(c.date).toLocaleDateString()}</p>
                                {c.notes && (
                                  <p className="text-[10px] text-slate-400 mt-1 italic border-l border-slate-800 pl-2">"{c.notes}"</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  onClick={() => handleReject(c)}
                                  className="flex-1 bg-red-500/10 hover:bg-red-500 hover:text-slate-950 border border-red-500/20 px-2 py-1.5 rounded-lg font-semibold font-mono text-[10px] flex items-center justify-center gap-1 transition-all cursor-pointer"
                                >
                                  <X className="w-3 h-3" /> REJECT
                                </button>
                                <button
                                  onClick={() => handleApprove(c)}
                                  className="flex-1 bg-emerald-500/10 hover:bg-emerald-500 hover:text-slate-950 border border-emerald-500/20 px-2 py-1.5 rounded-lg font-semibold font-mono text-[10px] flex items-center justify-center gap-1 transition-all cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[3]" /> APPROVE
                                </button>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Auto-Deducted Missed Payments Log */}
              <div className="p-6 bg-slate-900/40 border border-slate-900 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                  <h4 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-500" /> Share Auto-Deductions
                  </h4>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase font-bold">
                    {autoDeductions.length} Logged
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                  List of automated share debits executed on the 10th of each month for non-compliant members.
                </p>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {autoDeductions.length === 0 ? (
                    <div className="p-4 bg-slate-950/30 border border-slate-900 rounded-xl text-center text-xs text-slate-500 space-y-1">
                      <CheckCircle className="w-5 h-5 mx-auto text-slate-600" />
                      <p className="font-mono text-[9px] uppercase font-bold tracking-wider text-slate-400">Perfect Compliance</p>
                      <p className="text-[10px] text-slate-500">No automated share deductions logged.</p>
                    </div>
                  ) : (
                    autoDeductions.map((c) => (
                      <div key={c.id} className="p-3 bg-slate-950 border border-slate-850 rounded-xl space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-200">{c.memberName}</span>
                          <span className="font-mono text-amber-450 font-extrabold text-[11px] bg-amber-500/5 border border-amber-500/10 px-1.5 py-0.5 rounded">
                            {c.amount.toLocaleString()} {chama.currency}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
                          <span>Debit Date: {new Date(c.date).toLocaleDateString()}</span>
                          <span className="text-amber-500 font-extrabold uppercase tracking-widest text-[8px]">SHARES DEBITED</span>
                        </div>
                        {c.notes && (
                          <p className="text-[10px] text-slate-400 leading-relaxed bg-slate-950/60 p-2 rounded border border-slate-900/60 italic">
                            "{c.notes}"
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

          </div>
        </>
      )}

      {/* Record Contribution Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 relative"
            >
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-500" /> Record Member Contribution
                </h3>
                <p className="text-xs text-slate-400">
                  Submit a savings contribution or repayment receipt on behalf of a specific member
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-950/50 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleRecordContribution} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-mono">Chama Member</label>
                  <select
                    value={selectedMemberId}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.role === "chairperson" ? "Super Admin" : m.role === "treasurer" ? "Treasurer" : m.role === "secretary" ? "Secretary" : "Member"})
                      </option>
                    ))}
                    {!members.some((m) => m.id === currentUserId) && (
                      <option value={currentUserId}>
                        {currentUserDisplayName} (You)
                      </option>
                    )}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-mono">Amount Paid ({chama.currency})</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                    placeholder="e.g. 1000"
                  />
                  {amount && !isNaN(parseFloat(amount)) && (
                    <p className="text-[10px] text-emerald-400 font-mono mt-1">
                      ✨ Equivalent to {(parseFloat(amount) / (chama.sharePrice || 2000)).toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})} Shares (at {(chama.sharePrice || 2000).toLocaleString()} {chama.currency}/share)
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-mono">Payment Category</label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="savings">Regular Savings</option>
                      <option value="investment">Project Investment</option>
                      <option value="loan_repayment">Loan Repayment</option>
                      <option value="fine">Late Fee / Fine</option>
                      <option value="other">Other Contribution</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-mono">Payment Date</label>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-mono">Verification Notes / Receipt No.</label>
                  <input
                    type="text"
                    placeholder="e.g. M-Pesa receipt ref: QRF92KLS..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-xs font-mono text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                  >
                    {submitting ? "Submitting..." : "Submit Payment"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Contribution Modal */}
      <AnimatePresence>
        {showEditModal && selectedContribToEdit && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 relative"
            >
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Edit2 className="w-5 h-5 text-emerald-500" /> Amend Member Contribution
                </h3>
                <p className="text-xs text-slate-400">
                  Modify details, adjust payment value, or update approval status for this transaction.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-950/50 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-mono block">Chama Member</label>
                  <div className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-sm text-slate-300 select-none">
                    {selectedContribToEdit.memberName}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-mono block">Amount Paid ({chama.currency})</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  {editAmount && !isNaN(parseFloat(editAmount)) && (
                    <p className="text-[10px] text-emerald-400 font-mono mt-1">
                      ✨ Equivalent to {(parseFloat(editAmount) / (chama.sharePrice || 2000)).toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})} Shares (at {(chama.sharePrice || 2000).toLocaleString()} {chama.currency}/share)
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-mono block">Payment Category</label>
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="savings">Regular Savings</option>
                      <option value="investment">Project Investment</option>
                      <option value="loan_repayment">Loan Repayment</option>
                      <option value="fine">Late Fee / Fine</option>
                      <option value="other">Other Contribution</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-mono block">Payment Date</label>
                    <input
                      type="date"
                      required
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-mono block">Verification Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="pending">Pending Verification</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-mono block">Verification Notes / Receipt No.</label>
                  <input
                    type="text"
                    placeholder="e.g. M-Pesa receipt ref: QRF92KLS..."
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedContribToEdit(null);
                    }}
                    className="px-4 py-2 text-xs font-mono text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                  >
                    {savingEdit ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
