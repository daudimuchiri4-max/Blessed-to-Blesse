import React, { useState, useEffect } from "react";
import { collection, onSnapshot, doc, addDoc, updateDoc, increment } from "firebase/firestore";
import { db } from "../firebase";
import { Chama, Loan, Member, Contribution } from "../types";
import { Plus, Wallet, ShieldCheck, Check, X, Calendar, DollarSign, Percent, AlertCircle, RefreshCw, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { createChamaNotification } from "../utils/notifications";

interface LoansTabProps {
  chama: Chama;
  currentUserId: string;
  memberRole: Member["role"] | null;
  currentUserDisplayName: string;
}

interface AmortizationRow {
  installmentNo: number;
  dueDate: string;
  installmentAmount: number;
  principalPortion: number;
  interestPortion: number;
  remainingBalance: number;
  status: "paid" | "partially_paid" | "unpaid";
  amountPaidInRow: number;
}

export default function LoansTab({ chama, currentUserId, memberRole, currentUserDisplayName }: LoansTabProps) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);

  // Amortization Schedules expanded state
  const [expandedSchedules, setExpandedSchedules] = useState<Record<string, boolean>>({});

  // Modal / Form states
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [amount, setAmount] = useState("");
  const [interestRate, setInterestRate] = useState("5"); // Default 5%
  const [termMonths, setTermMonths] = useState("3"); // Default 3 months
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Members list & guarantor states
  const [members, setMembers] = useState<Member[]>([]);
  const [guarantor1, setGuarantor1] = useState("");
  const [guarantor2, setGuarantor2] = useState("");
  const [guarantor3, setGuarantor3] = useState("");
  const [agreedToAutoDeduct, setAgreedToAutoDeduct] = useState(false);

  // Recovery modal state
  const [recoveringLoan, setRecoveringLoan] = useState<Loan | null>(null);
  const [recovering, setRecovering] = useState(false);

  const isAdmin = memberRole === "super_admin" || memberRole === "chairperson" || chama.createdBy === currentUserId;
  const isAuthorizedOfficial = isAdmin || memberRole === "treasurer";
  const isOfficer = isAuthorizedOfficial || (memberRole && ["secretary", "vice_chairperson"].includes(memberRole));
  const isChairperson = memberRole === "chairperson" || memberRole === "super_admin" || chama.createdBy === currentUserId;
  const isTreasurer = memberRole === "treasurer" || memberRole === "super_admin" || chama.createdBy === currentUserId;

  // Helper: get total approved savings contributions of a member
  const getMemberApprovedSavings = (userId: string) => {
    return contributions
      .filter((c) => (c.userId === userId) && c.type === "savings" && c.status === "approved")
      .reduce((sum, c) => sum + c.amount, 0);
  };

  // Helper: Generate amortization schedule
  const generateAmortizationSchedule = (loan: Loan): AmortizationRow[] => {
    const term = loan.repaymentTermMonths;
    const principal = loan.amount;
    const rate = loan.interestRate;
    const totalPayable = principal * (1 + rate / 100);
    const installmentAmount = totalPayable / term;
    const principalPortion = principal / term;
    const interestPortion = (principal * (rate / 100)) / term;

    const rows: AmortizationRow[] = [];
    let accumRepaid = loan.amountRepaid;

    const startDateObj = new Date(loan.dateRequested);

    for (let i = 1; i <= term; i++) {
      const dueDateObj = new Date(startDateObj);
      dueDateObj.setMonth(startDateObj.getMonth() + i);

      let rowStatus: "paid" | "partially_paid" | "unpaid" = "unpaid";
      let amountPaidInRow = 0;

      if (accumRepaid >= installmentAmount) {
        rowStatus = "paid";
        amountPaidInRow = installmentAmount;
        accumRepaid -= installmentAmount;
      } else if (accumRepaid > 0) {
        rowStatus = "partially_paid";
        amountPaidInRow = accumRepaid;
        accumRepaid = 0;
      } else {
        rowStatus = "unpaid";
        amountPaidInRow = 0;
      }

      const remainingBalance = Math.max(totalPayable - (i * installmentAmount), 0);

      rows.push({
        installmentNo: i,
        dueDate: dueDateObj.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }),
        installmentAmount,
        principalPortion,
        interestPortion,
        remainingBalance,
        status: rowStatus,
        amountPaidInRow
      });
    }

    return rows;
  };

  // Subscribe to contributions in real-time
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "chamas", chama.id, "contributions"),
      (snapshot) => {
        const list: Contribution[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Contribution);
        });
        setContributions(list);
      },
      (error) => {
        console.error("Error loading contributions:", error);
      }
    );

    return () => unsubscribe();
  }, [chama.id]);

  // Subscribe to loans in real-time
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "chamas", chama.id, "loans"),
      (snapshot) => {
        const list: Loan[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Loan);
        });
        // Sort: pending first, then active, then repaid
        list.sort((a, b) => {
          const statusOrder = { pending: 0, active: 1, approved: 2, repaid: 3, rejected: 4 };
          return (statusOrder[a.status] || 9) - (statusOrder[b.status] || 9);
        });
        setLoans(list);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading loans:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [chama.id]);

  // Subscribe to group members in real-time
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "chamas", chama.id, "members"),
      (snapshot) => {
        const list: Member[] = [];
        snapshot.forEach((doc) => {
          const m = { id: doc.id, ...doc.data() } as Member;
          // Filter out pending members and the main system admin email
          if (!m.isPending && m.email !== "superadmin@chama.com") {
            list.push(m);
          }
        });
        // Sort alphabetically by name
        list.sort((a, b) => a.name.localeCompare(b.name));
        setMembers(list);
      },
      (error) => {
        console.error("Error loading members in LoansTab:", error);
      }
    );

    return () => unsubscribe();
  }, [chama.id]);

  const handleRequestLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    const principal = parseFloat(amount);
    const rate = parseFloat(interestRate);
    const term = parseInt(termMonths);

    if (isNaN(principal) || principal <= 0 || isNaN(rate) || rate < 0 || isNaN(term) || term <= 0) {
      setError("Please fill out all fields with valid values.");
      return;
    }

    if (!guarantor1 || !guarantor2 || !guarantor3) {
      setError("Please select exactly 3 group members to sign as co-signers/guarantors.");
      return;
    }

    if (guarantor1 === guarantor2 || guarantor1 === guarantor3 || guarantor2 === guarantor3) {
      setError("You must select 3 different group members to sign. Duplicate co-signers are not allowed.");
      return;
    }

    const selectedG1 = members.find(m => m.id === guarantor1 || m.userId === guarantor1);
    const selectedG2 = members.find(m => m.id === guarantor2 || m.userId === guarantor2);
    const selectedG3 = members.find(m => m.id === guarantor3 || m.userId === guarantor3);

    if (!selectedG1 || !selectedG2 || !selectedG3) {
      setError("Please select exactly 3 valid group members to sign as co-signers/guarantors.");
      return;
    }

    if (
      selectedG1.id === currentUserId || selectedG1.userId === currentUserId ||
      selectedG2.id === currentUserId || selectedG2.userId === currentUserId ||
      selectedG3.id === currentUserId || selectedG3.userId === currentUserId
    ) {
      setError("You cannot select yourself as a co-signer/guarantor.");
      return;
    }

    // Verify co-signer shares/savings eligibility (must cover 1/3 of the requested loan)
    const requiredGuaranteePerCoSigner = principal / 3;
    const g1Savings = Math.max(getMemberApprovedSavings(selectedG1.userId), getMemberApprovedSavings(selectedG1.id));
    const g2Savings = Math.max(getMemberApprovedSavings(selectedG2.userId), getMemberApprovedSavings(selectedG2.id));
    const g3Savings = Math.max(getMemberApprovedSavings(selectedG3.userId), getMemberApprovedSavings(selectedG3.id));

    if (g1Savings < requiredGuaranteePerCoSigner) {
      if (isOfficer) {
        setError(`Co-signer "${selectedG1.name}" has insufficient shares. They have ${g1Savings.toLocaleString()} ${chama.currency} in savings, but must have at least ${requiredGuaranteePerCoSigner.toLocaleString()} ${chama.currency} (1/3 of your ${principal.toLocaleString()} ${chama.currency} loan) to guarantee.`);
      } else {
        setError(`Co-signer "${selectedG1.name}" has insufficient shares to guarantee this loan. Each co-signer must have at least ${requiredGuaranteePerCoSigner.toLocaleString()} ${chama.currency} in shares/savings.`);
      }
      return;
    }

    if (g2Savings < requiredGuaranteePerCoSigner) {
      if (isOfficer) {
        setError(`Co-signer "${selectedG2.name}" has insufficient shares. They have ${g2Savings.toLocaleString()} ${chama.currency} in savings, but must have at least ${requiredGuaranteePerCoSigner.toLocaleString()} ${chama.currency} (1/3 of your ${principal.toLocaleString()} ${chama.currency} loan) to guarantee.`);
      } else {
        setError(`Co-signer "${selectedG2.name}" has insufficient shares to guarantee this loan. Each co-signer must have at least ${requiredGuaranteePerCoSigner.toLocaleString()} ${chama.currency} in shares/savings.`);
      }
      return;
    }

    if (g3Savings < requiredGuaranteePerCoSigner) {
      if (isOfficer) {
        setError(`Co-signer "${selectedG3.name}" has insufficient shares. They have ${g3Savings.toLocaleString()} ${chama.currency} in savings, but must have at least ${requiredGuaranteePerCoSigner.toLocaleString()} ${chama.currency} (1/3 of your ${principal.toLocaleString()} ${chama.currency} loan) to guarantee.`);
      } else {
        setError(`Co-signer "${selectedG3.name}" has insufficient shares to guarantee this loan. Each co-signer must have at least ${requiredGuaranteePerCoSigner.toLocaleString()} ${chama.currency} in shares/savings.`);
      }
      return;
    }

    if (!agreedToAutoDeduct) {
      setError("You must read and agree to the automatic shares/savings deduction policy to submit this application.");
      return;
    }

    // Verify member shares/savings (limit is 3x of owned shares value/savings)
    const mySavings = getMemberApprovedSavings(currentUserId);
    const maxEligibleLoan = mySavings * 3;

    if (mySavings <= 0) {
      setError(`Access denied. You do not own any shares. Members must have approved savings/shares to qualify for cooperative credit.`);
      return;
    }

    if (principal > maxEligibleLoan) {
      setError(`Request exceeds cooperative credit limit. Based on your owned shares (${(mySavings / (chama.sharePrice || 2000)).toFixed(1)} Units worth ${mySavings.toLocaleString()} ${chama.currency}), your maximum eligible loan amount is ${maxEligibleLoan.toLocaleString()} ${chama.currency} (3x of your shares).`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Calculate due date (term in months from now)
      const dueDateObj = new Date();
      dueDateObj.setMonth(dueDateObj.getMonth() + term);

      const loanData: Omit<Loan, "id"> = {
        userId: currentUserId,
        memberName: currentUserDisplayName,
        amount: principal,
        interestRate: rate,
        repaymentTermMonths: term,
        amountRepaid: 0,
        status: "pending",
        dateRequested: new Date().toISOString(),
        dueDate: dueDateObj.toISOString().split("T")[0],
        guarantors: [
          selectedG1?.name || "Guarantor 1",
          selectedG2?.name || "Guarantor 2",
          selectedG3?.name || "Guarantor 3"
        ],
        agreedToDeduction: agreedToAutoDeduct,
      };

      await addDoc(collection(db, "chamas", chama.id, "loans"), loanData);

      await createChamaNotification(chama.id, {
        title: "Loan Request Submitted",
        message: `${loanData.memberName} requested a loan of ${principal.toLocaleString()} ${chama.currency} co-signed by ${loanData.guarantors?.join(", ")}.`,
        type: "warning",
        link: "loans",
      });

      // Reset
      setAmount("");
      setInterestRate("5");
      setTermMonths("3");
      setGuarantor1("");
      setGuarantor2("");
      setGuarantor3("");
      setAgreedToAutoDeduct(false);
      setShowRequestModal(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to request loan.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveLoan = async (loan: Loan) => {
    try {
      // 1. Set loan status to active
      await updateDoc(doc(db, "chamas", chama.id, "loans", loan.id), {
        status: "active",
        approvedBy: currentUserId,
      });

      // 2. Increment Chama outstanding loans total
      await updateDoc(doc(db, "chamas", chama.id), {
        totalLoans: increment(loan.amount),
        // Draw loan amount from savings pool
        totalSavings: increment(-loan.amount),
      });

      // Send a targeted notification to the borrower
      await createChamaNotification(chama.id, {
        title: "Loan Approved",
        message: `Your loan of ${loan.amount.toLocaleString()} ${chama.currency} has been approved and advanced.`,
        type: "success",
        userId: loan.userId,
        link: "loans",
      });

      // Send a general notification to all members about credit disbursement
      await createChamaNotification(chama.id, {
        title: "Loan Disbursed",
        message: `Cooperative loan of ${loan.amount.toLocaleString()} ${chama.currency} has been approved and disbursed to ${loan.memberName}.`,
        type: "info",
        link: "loans",
      });
    } catch (err) {
      console.error("Error approving loan:", err);
    }
  };

  const handleApproveRole = async (loan: Loan, roleType: "chair" | "treasurer") => {
    try {
      const updates: Partial<Loan> = {};
      if (roleType === "chair") {
        updates.approvedByChair = currentUserDisplayName || "Chairperson";
      } else {
        updates.approvedByTreasurer = currentUserDisplayName || "Treasurer";
      }

      // Check if this approval will complete both requirements
      const willBeFullyApproved = 
        (roleType === "chair" ? !!updates.approvedByChair : !!loan.approvedByChair) &&
        (roleType === "treasurer" ? !!updates.approvedByTreasurer : !!loan.approvedByTreasurer);

      if (willBeFullyApproved) {
        updates.status = "active";
        updates.approvedBy = currentUserId; // general fallback
      }

      await updateDoc(doc(db, "chamas", chama.id, "loans", loan.id), updates);

      if (willBeFullyApproved) {
        // Increment Chama outstanding loans total
        await updateDoc(doc(db, "chamas", chama.id), {
          totalLoans: increment(loan.amount),
          // Draw loan amount from savings pool
          totalSavings: increment(-loan.amount),
        });

        // Send a targeted notification to the borrower
        await createChamaNotification(chama.id, {
          title: "Loan Approved",
          message: `Your loan of ${loan.amount.toLocaleString()} ${chama.currency} has been approved by the Chairperson and Treasurer, and has been disbursed.`,
          type: "success",
          userId: loan.userId,
          link: "loans",
        });

        // Send a general notification to all members about credit disbursement
        await createChamaNotification(chama.id, {
          title: "Loan Disbursed",
          message: `Cooperative loan of ${loan.amount.toLocaleString()} ${chama.currency} has been approved by Chairperson and Treasurer and disbursed to ${loan.memberName}.`,
          type: "info",
          link: "loans",
        });
      } else {
        // Notification for single-stage approval
        await createChamaNotification(chama.id, {
          title: "Loan Sign-off Added",
          message: `${currentUserDisplayName} signed off on the loan request for ${loan.memberName} as ${roleType === "chair" ? "Chairperson" : "Treasurer"}. Awaiting other official approval.`,
          type: "warning",
          link: "loans",
        });
      }
    } catch (err) {
      console.error("Error signing off loan:", err);
    }
  };

  const handleRejectLoan = async (loan: Loan) => {
    try {
      await updateDoc(doc(db, "chamas", chama.id, "loans", loan.id), {
        status: "rejected",
        approvedBy: currentUserId,
      });

      await createChamaNotification(chama.id, {
        title: "Loan Request Declined",
        message: `Your loan request of ${loan.amount.toLocaleString()} ${chama.currency} was declined by the group officials.`,
        type: "alert",
        userId: loan.userId,
        link: "loans",
      });
    } catch (err) {
      console.error("Error rejecting loan:", err);
    }
  };

  const handleRecoverFromShares = async (loan: Loan) => {
    const totalPayable = loan.amount * (1 + loan.interestRate / 100);
    const outstanding = totalPayable - loan.amountRepaid;

    if (outstanding <= 0) {
      return;
    }

    setRecovering(true);

    try {
      // 1. Add an approved negative savings contribution to deduct from borrower's savings/shares
      const recoveryContribution = {
        userId: loan.userId,
        memberName: loan.memberName,
        amount: -outstanding,
        date: new Date().toISOString().split("T")[0],
        type: "savings",
        status: "approved",
        notes: `Automated recovery for unpaid Loan. Outstanding balance of ${outstanding.toLocaleString()} ${chama.currency} recovered directly from owned shares/savings.`,
        approvedBy: currentUserId,
        approvedAt: new Date().toISOString()
      };

      await addDoc(collection(db, "chamas", chama.id, "contributions"), recoveryContribution);

      // 2. Mark the loan as fully repaid
      await updateDoc(doc(db, "chamas", chama.id, "loans", loan.id), {
        amountRepaid: increment(outstanding),
        status: "repaid",
        recoveredFromShares: true,
        recoveredAt: new Date().toISOString(),
      });

      // 3. Update main Chama document's outstanding loans (decrements by outstanding)
      // And also decrement totalSavings by outstanding (since those savings are spent/canceled!)
      await updateDoc(doc(db, "chamas", chama.id), {
        totalLoans: increment(-outstanding),
        totalSavings: increment(-outstanding),
      });

      // 4. Send targeted notification to borrower
      await createChamaNotification(chama.id, {
        title: "Loan Default Recovered",
        message: `Your outstanding loan of ${outstanding.toLocaleString()} ${chama.currency} has been recovered directly from your savings/shares.`,
        type: "alert",
        userId: loan.userId,
        link: "loans",
      });

      // 5. Send general notification to group
      await createChamaNotification(chama.id, {
        title: "Default Recovery Executed",
        message: `Cooperative default recovery executed: ${outstanding.toLocaleString()} ${chama.currency} recovered from ${loan.memberName}'s shares to settle outstanding loan.`,
        type: "info",
        link: "loans",
      });

      setRecoveringLoan(null);
    } catch (err) {
      console.error("Error executing default recovery:", err);
    } finally {
      setRecovering(false);
    }
  };

  // Live calculated stats for modal
  const calcTotalPayable = () => {
    const principal = parseFloat(amount) || 0;
    const rate = parseFloat(interestRate) || 0;
    return principal * (1 + rate / 100);
  };

  const calcMonthlyInstallment = () => {
    const total = calcTotalPayable();
    const months = parseInt(termMonths) || 1;
    return total / months;
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* Header and Trigger Row */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white">Chama Mutual Credit Unions</h3>
          <p className="text-xs text-slate-500">Access cooperative member credits drawn directly from pooled savings.</p>
        </div>
        <button
          onClick={() => setShowRequestModal(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
        >
          <Plus className="w-4 h-4 stroke-[3]" /> Request Member Loan
        </button>
      </div>

      {/* Guide notice explaining repayment linking */}
      <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-xl flex items-start gap-3.5 text-xs text-slate-400">
        <HelpCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-200">How do repayments work?</p>
          <p>
            To repay an active loan, go to the <span className="text-emerald-400 font-semibold font-mono">Contributions</span> tab 
            and record a contribution under the category <span className="font-semibold text-white">"Loan Repayment"</span>. 
            Once the Treasurer verifies and approves your payment, your outstanding loan balance will be instantly paid down!
          </p>
        </div>
      </div>

      {/* Split views: Loans listing, and pending loans approvals */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left: Active and past loans list */}
        <div className="lg:col-span-8 p-6 bg-slate-900/40 border border-slate-900 rounded-2xl space-y-4">
          <h4 className="text-sm font-bold text-white font-mono uppercase tracking-wider border-b border-slate-900 pb-3">
            Group Loan Ledger
          </h4>

          {loading ? (
            <div className="space-y-3 py-6">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 bg-slate-900/20 border border-slate-900 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : loans.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs font-mono space-y-2">
              <Wallet className="w-8 h-8 text-slate-700 mx-auto" />
              <p>No loans registered in the system yet.</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
              {loans.map((l) => {
                const totalPayable = l.amount * (1 + l.interestRate / 100);
                const progressPercent = Math.min((l.amountRepaid / totalPayable) * 100, 100);

                return (
                  <div 
                    key={l.id} 
                    className="p-4 bg-slate-950/40 border border-slate-900 rounded-xl space-y-3 hover:border-slate-800 transition-all text-xs"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="font-bold text-slate-200 text-sm">{l.memberName}</h5>
                          {l.userId === currentUserId && (
                            <span className="text-[9px] font-mono px-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded">YOUR LOAN</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono uppercase mt-0.5">
                          Requested: {new Date(l.dateRequested).toLocaleDateString()} • Due: {new Date(l.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                        l.status === "active" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" :
                        l.status === "repaid" ? "bg-blue-500/15 text-blue-400 border border-blue-500/20" :
                        l.status === "pending" ? "bg-amber-500/15 text-amber-400 border border-amber-500/20" :
                        "bg-red-500/15 text-red-400 border border-red-500/20"
                      }`}>
                        {l.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-900/60 font-mono">
                      <div>
                        <p className="text-[9px] text-slate-500 uppercase">Principal</p>
                        <p className="font-semibold text-slate-300">{l.amount.toLocaleString()} {chama.currency}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-500 uppercase">Total Owed (+{l.interestRate}%)</p>
                        <p className="font-semibold text-slate-300">{totalPayable.toLocaleString()} {chama.currency}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-500 uppercase">Repaid Balance</p>
                        <p className="font-semibold text-emerald-400">{l.amountRepaid.toLocaleString()} {chama.currency}</p>
                      </div>
                    </div>

                    {/* Progress repayment bar */}
                    {l.status === "active" && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-mono text-slate-500">
                          <span>Repayment coverage</span>
                          <span>{progressPercent.toFixed(0)}% Repaid</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${progressPercent}%` }} />
                        </div>
                      </div>
                    )}

                    {l.guarantors && l.guarantors.length > 0 && (
                      <div className="text-[10px] text-slate-400 bg-slate-950/40 p-2.5 rounded-xl border border-slate-900/60 flex items-start gap-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-slate-300">Co-signers (Guarantors):</p>
                          <p className="text-slate-400">{l.guarantors.join(", ")}</p>
                        </div>
                      </div>
                    )}

                    {l.status === "active" && isAuthorizedOfficial && (
                      <div className="pt-1 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => setRecoveringLoan(l)}
                          className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold font-mono tracking-wider uppercase bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-slate-950 border border-amber-500/20 hover:border-transparent transition-all flex items-center gap-1 cursor-pointer"
                          title="If member fails to pay, recover outstanding balance directly from their shares"
                        >
                          <AlertCircle className="w-3.5 h-3.5" /> Recover from Shares
                        </button>
                      </div>
                    )}

                    {/* Amortization Schedule Section */}
                    {(l.status === "active" || l.status === "repaid") && (
                      <div className="pt-2 border-t border-slate-900/40 space-y-2">
                        <button
                          type="button"
                          onClick={() => setExpandedSchedules(prev => ({ ...prev, [l.id]: !prev[l.id] }))}
                          className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 hover:text-emerald-300 font-bold uppercase tracking-wider cursor-pointer transition-colors"
                        >
                          {expandedSchedules[l.id] ? (
                            <>
                              <ChevronUp className="w-3.5 h-3.5" />
                              <span>Hide Amortization Schedule</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5" />
                              <span>View Amortization Schedule</span>
                            </>
                          )}
                        </button>

                        <AnimatePresence>
                          {expandedSchedules[l.id] && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="bg-slate-950/60 rounded-xl border border-slate-900/80 p-3 space-y-2 pt-3 mt-1">
                                <div className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider pb-1.5 border-b border-slate-900/60 flex items-center justify-between">
                                  <span>Repayment Breakdown</span>
                                  <span className="text-emerald-500">{l.repaymentTermMonths} Months Flat</span>
                                </div>
                                <div className="overflow-x-auto scrollbar-none">
                                  <table className="w-full text-left border-collapse">
                                    <thead>
                                      <tr className="border-b border-slate-900 text-[8px] font-mono uppercase text-slate-500 tracking-wider">
                                        <th className="py-1 px-1.5 text-center">Inst</th>
                                        <th className="py-1 px-1.5">Due Date</th>
                                        <th className="py-1 px-1.5 text-right">Amount</th>
                                        <th className="py-1 px-1.5 text-right">Principal + Int</th>
                                        <th className="py-1 px-1.5 text-center">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-900/40 font-mono text-[10px]">
                                      {generateAmortizationSchedule(l).map((row) => (
                                        <tr key={row.installmentNo} className="hover:bg-slate-900/20">
                                          <td className="py-1.5 px-1.5 text-center text-slate-400">{row.installmentNo}</td>
                                          <td className="py-1.5 px-1.5 text-slate-300 whitespace-nowrap">{row.dueDate}</td>
                                          <td className="py-1.5 px-1.5 text-right font-semibold text-slate-200">
                                            {Math.round(row.installmentAmount).toLocaleString()} {chama.currency}
                                          </td>
                                          <td className="py-1.5 px-1.5 text-right text-slate-500 text-[9px] whitespace-nowrap">
                                            {Math.round(row.principalPortion).toLocaleString()} + {Math.round(row.interestPortion).toLocaleString()}
                                          </td>
                                          <td className="py-1.5 px-1.5 text-center">
                                            <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase whitespace-nowrap ${
                                              row.status === "paid"
                                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                                : row.status === "partially_paid"
                                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                                : "bg-slate-900 text-slate-500 border border-slate-800"
                                            }`}>
                                              {row.status === "paid" && "Paid"}
                                              {row.status === "partially_paid" && `Partial`}
                                              {row.status === "unpaid" && "Unpaid"}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Admin Approvals Panel */}
        <div className="lg:col-span-4 p-6 bg-slate-900/40 border border-slate-900 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-900 pb-3">
            <h4 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
              Credit Approvals
            </h4>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
              {isAuthorizedOfficial ? "OFFICIAL ACCESS" : "VIEW ONLY"}
            </span>
          </div>

          {!isAuthorizedOfficial ? (
            <div className="p-4 bg-slate-950/20 border border-slate-900 rounded-xl space-y-2 text-xs text-slate-500 text-center">
              <AlertCircle className="w-6 h-6 mx-auto text-slate-700" />
              <p className="font-mono text-[10px]">APPROVALS RESTRICTED</p>
              <p>Only the Chairperson, Treasurer, and designated administrators can authorize member loan releases.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-[11px] text-slate-400">
                Cooperative loans require multi-stage dual approval (both Chairperson and Treasurer) before principal capital is released from the savings pool.
              </p>

              <div className="space-y-3">
                {loans.filter((l) => l.status === "pending").length === 0 ? (
                  <div className="p-4 bg-slate-950/30 border border-slate-900 rounded-xl text-center text-xs text-slate-500 space-y-2">
                    <ShieldCheck className="w-6 h-6 mx-auto text-slate-700" />
                    <p className="font-mono text-[10px]">ALL CLEAR</p>
                    <p>No loan requests waiting for release.</p>
                  </div>
                ) : (
                  loans
                    .filter((l) => l.status === "pending")
                    .map((l) => {
                      const totalPayable = l.amount * (1 + l.interestRate / 100);
                      const applicantSavings = getMemberApprovedSavings(l.userId);
                      const applicantShares = applicantSavings / (chama.sharePrice || 2000);
                      const maxLimit = applicantSavings * 3;
                      const withinLimit = l.amount <= maxLimit;

                      return (
                        <div key={l.id} className="p-3 bg-slate-950 border border-slate-850 rounded-xl space-y-2.5 text-xs">
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-200">{l.memberName}</span>
                              <span className="font-mono text-amber-400 font-extrabold">{l.amount.toLocaleString()} {chama.currency}</span>
                            </div>
                            <p className="text-[9px] text-slate-500 font-mono uppercase pt-0.5">
                              Term: {l.repaymentTermMonths} mo • Rate: {l.interestRate}% ({totalPayable.toLocaleString()} {chama.currency} total due)
                            </p>
                            
                            {l.guarantors && l.guarantors.length > 0 && (
                              <div className="mt-2 text-[9px] text-slate-400 bg-slate-900/40 p-2 rounded-lg border border-slate-850 flex items-start gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-semibold text-slate-300">Co-signers (each guarantees {(l.amount / 3).toLocaleString()} {chama.currency}):</span>{" "}
                                  <span className="text-slate-400">{l.guarantors.join(", ")}</span>
                                </div>
                              </div>
                            )}

                            {/* Dual Approvals Signatures Status */}
                            <div className="mt-2.5 pt-2 border-t border-slate-900/60 space-y-2 text-[10px]">
                              <p className="font-semibold text-slate-300 uppercase tracking-wider text-[9px] font-mono">Sign-off Status:</p>
                              
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">1. Chairperson Sign-off:</span>
                                {l.approvedByChair ? (
                                  <span className="text-emerald-400 font-medium font-mono flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[9px]">
                                    <Check className="w-3 h-3 stroke-[3]" /> {l.approvedByChair}
                                  </span>
                                ) : (
                                  <span className="text-amber-500 font-medium font-mono bg-amber-500/10 px-1.5 py-0.5 rounded text-[9px]">Awaiting Sign-off</span>
                                )}
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">2. Treasurer Sign-off:</span>
                                {l.approvedByTreasurer ? (
                                  <span className="text-emerald-400 font-medium font-mono flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[9px]">
                                    <Check className="w-3 h-3 stroke-[3]" /> {l.approvedByTreasurer}
                                  </span>
                                ) : (
                                  <span className="text-amber-500 font-medium font-mono bg-amber-500/10 px-1.5 py-0.5 rounded text-[9px]">Awaiting Sign-off</span>
                                )}
                              </div>
                            </div>

                            <div className="mt-2.5 pt-2 border-t border-slate-900/60 space-y-1 text-[10px] font-mono">
                              <div className="flex items-center justify-between text-slate-400">
                                <span>Member Shares:</span>
                                <span>{applicantShares.toFixed(1)} Units ({applicantSavings.toLocaleString()} {chama.currency})</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-450">3X Loan Limit:</span>
                                <span className={`font-semibold ${withinLimit ? "text-emerald-400" : "text-red-400"}`}>
                                  {maxLimit.toLocaleString()} {chama.currency} {withinLimit ? "✓ OK" : "⚠ OVER LIMIT"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 pt-1 border-t border-slate-900/60">
                            {/* Approve Actions */}
                            <div className="flex gap-2">
                              {isChairperson && !l.approvedByChair && (
                                <button
                                  onClick={() => handleApproveRole(l, "chair")}
                                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-2 py-1.5 rounded-lg font-bold font-mono text-[9px] flex items-center justify-center gap-1 transition-all cursor-pointer"
                                >
                                  <Check className="w-3 h-3 stroke-[3]" /> SIGN CHAIR
                                </button>
                              )}

                              {isTreasurer && !l.approvedByTreasurer && (
                                <button
                                  onClick={() => handleApproveRole(l, "treasurer")}
                                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-2 py-1.5 rounded-lg font-bold font-mono text-[9px] flex items-center justify-center gap-1 transition-all cursor-pointer"
                                >
                                  <Check className="w-3 h-3 stroke-[3]" /> SIGN TREASURER
                                </button>
                              )}
                            </div>

                            {/* Decline Action */}
                            <button
                              onClick={() => handleRejectLoan(l)}
                              className="w-full bg-red-500/10 hover:bg-red-500 hover:text-slate-950 border border-red-500/20 px-2 py-1.5 rounded-lg font-semibold font-mono text-[10px] flex items-center justify-center gap-1 transition-all cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" /> REJECT APPLICATION
                            </button>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Request Loan Modal */}
      <AnimatePresence>
        {showRequestModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 sm:p-6 relative max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
                <div className="space-y-0.5">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-emerald-500" /> Apply for Member Loan
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Request cooperative credit from the collective Chama savings pool
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleRequestLoan} className="flex-1 flex flex-col min-h-0 pt-3">
                <div className="flex-1 overflow-y-auto pr-1.5 space-y-4 scrollbar-thin">
                  {error && (
                    <div className="p-3 bg-red-950/50 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Cooperative Loan Limit Rule Guide */}
                  {(() => {
                    const mySavings = getMemberApprovedSavings(currentUserId);
                    const myShares = mySavings / (chama.sharePrice || 2000);
                    const maxLoan = mySavings * 3;

                    if (mySavings <= 0) {
                      return (
                        <div className="p-3.5 bg-amber-950/40 border border-amber-500/40 rounded-xl space-y-1.5 text-xs text-amber-300">
                          <div className="flex items-center gap-2 font-bold text-amber-400">
                            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                            <span>Ineligible for Loan: 0 Shares Owned</span>
                          </div>
                          <p className="text-[11px] text-amber-200/80 leading-relaxed">
                            You do not currently own any shares in this Chama. Under cooperative credit rules, a member must have approved shares/savings to qualify for a loan (maximum loan limit is 3x your total shares value).
                          </p>
                          <p className="text-[11px] text-emerald-400 font-semibold pt-0.5">
                            💡 Tip: Go to the <span className="underline font-mono">Contributions</span> tab to deposit savings and buy shares!
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="p-3 bg-slate-950 border border-slate-850 rounded-xl space-y-1 text-xs">
                        <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                          <span>Cooperative Rule Check</span>
                          <span className="text-emerald-400 font-extrabold font-sans">3X Shares Limit</span>
                        </div>
                        <div className="flex justify-between items-center pt-1.5">
                          <span className="text-slate-400">Your Owned Shares:</span>
                          <span className="font-semibold text-emerald-400 font-mono">
                            {myShares.toFixed(1)} Units ({mySavings.toLocaleString()} {chama.currency})
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Max Loan Eligibility:</span>
                          <span className="font-bold text-slate-200 font-mono">
                            {maxLoan.toLocaleString()} {chama.currency}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-mono">Loan Principal ({chama.currency})</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                      placeholder="e.g. 5000"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-400 font-mono">Cooperative Interest Rate (%)</label>
                      <input
                        type="number"
                        required
                        min={0}
                        value={interestRate}
                        onChange={(e) => setInterestRate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-400 font-mono">Term Duration (Months)</label>
                      <select
                        value={termMonths}
                        onChange={(e) => setTermMonths(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none cursor-pointer"
                      >
                        <option value="1">1 Month</option>
                        <option value="3">3 Months</option>
                        <option value="6">6 Months</option>
                        <option value="12">12 Months</option>
                      </select>
                    </div>
                  </div>

                  {/* Calculation breakdown */}
                  {parseFloat(amount) > 0 && (
                    <div className="p-3.5 bg-slate-950 border border-slate-850 rounded-xl text-xs space-y-1.5">
                      <p className="font-mono text-[10px] text-slate-500 uppercase">Amortization Estimate</p>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Total Interest Payable:</span>
                        <span className="font-semibold text-slate-200">
                          {((parseFloat(amount) || 0) * (parseFloat(interestRate) || 0) / 100).toLocaleString()} {chama.currency}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Total Repayable:</span>
                        <span className="font-bold text-emerald-400">
                          {calcTotalPayable().toLocaleString()} {chama.currency}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-slate-900 pt-1.5 mt-1.5">
                        <span className="text-slate-400">Monthly Installment:</span>
                        <span className="font-bold text-white">
                          {calcMonthlyInstallment().toLocaleString()} {chama.currency}/mo
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Cooperative Loan Guarantor Sign-off Rules */}
                  <div className="space-y-3 p-3.5 bg-slate-950/80 border border-slate-850 rounded-xl text-xs">
                    <p className="font-mono text-[10px] text-amber-500 font-extrabold uppercase flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Credit Rules & Guarantors
                    </p>
                    
                    <div className="text-[11px] text-slate-400 space-y-1.5 pb-2 border-b border-slate-900">
                      <p>1. <strong className="text-white">Must have 3 members of the group to sign:</strong> Select three distinct members as co-signers to guarantee your credit application.</p>
                      <p>2. <strong className="text-white">Repayment Default Protection:</strong> If you fail to repay, the system is authorized to automatically deduct the outstanding balance directly from your accumulated savings/shares.</p>
                    </div>

                    {/* 3 Select dropdowns for Co-signers */}
                    <div className="space-y-2">
                      {parseFloat(amount) > 0 && (
                        <div className="p-2 bg-slate-900/60 border border-slate-850 rounded-lg text-[10px] text-slate-400">
                          <span className="font-semibold text-slate-300">Minimum shares required per co-signer: </span>
                          <span className="text-amber-400 font-mono font-bold">
                            {(parseFloat(amount) / 3).toLocaleString()} {chama.currency}
                          </span>{" "}
                          ({((parseFloat(amount) / 3) / (chama.sharePrice || 2000)).toFixed(1)} Units)
                        </div>
                      )}

                      {/* Live Online Co-signers Helper Banner */}
                      {(() => {
                        const onlineOthers = members.filter(m => m.id !== currentUserId && m.userId !== currentUserId && m.lastSeen && (Date.now() - new Date(m.lastSeen).getTime() < 180000));
                        return (
                          <div className="p-2.5 bg-emerald-950/60 border border-emerald-500/30 rounded-lg space-y-1">
                            <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                              <span>Active Online Co-signers Available ({onlineOthers.length}):</span>
                            </div>
                            <p className="text-[10px] text-slate-300 font-mono">
                              {onlineOthers.length > 0
                                ? onlineOthers.map(m => `${m.name} (${m.role})`).join(", ")
                                : "No other co-signers active right now. You can still select registered group members to guarantee your request."}
                            </p>
                          </div>
                        );
                      })()}

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 font-mono uppercase">Guarantor / Co-signer 1</label>
                        <select
                          required
                          value={guarantor1}
                          onChange={(e) => setGuarantor1(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                        >
                          <option value="">-- Select Co-signer 1 --</option>
                          {members
                            .filter(m => m.id !== currentUserId && m.userId !== currentUserId && m.id !== guarantor2 && m.id !== guarantor3)
                            .sort((a, b) => {
                              const aOnline = a.lastSeen && (Date.now() - new Date(a.lastSeen).getTime() < 180000) ? 1 : 0;
                              const bOnline = b.lastSeen && (Date.now() - new Date(b.lastSeen).getTime() < 180000) ? 1 : 0;
                              return bOnline - aOnline;
                            })
                            .map(m => {
                              const savings = Math.max(getMemberApprovedSavings(m.userId), getMemberApprovedSavings(m.id));
                              const sharesCount = savings / (chama.sharePrice || 2000);
                              const required = (parseFloat(amount) || 0) / 3;
                              const hasEnough = !required || savings >= required;
                              const isOnline = m.lastSeen && (Date.now() - new Date(m.lastSeen).getTime() < 180000);

                              return (
                                <option key={m.id} value={m.id} disabled={!hasEnough}>
                                  {isOnline ? "🟢 [ONLINE NOW] " : "⚪ "}{m.name} ({m.role}) {isOfficer ? `— ${sharesCount.toFixed(1)} Shares (${savings.toLocaleString()} ${chama.currency})` : ""} {!hasEnough ? " ❌ (Insufficient shares)" : " ✓ Eligible"}
                                </option>
                              );
                            })}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 font-mono uppercase">Guarantor / Co-signer 2</label>
                        <select
                          required
                          value={guarantor2}
                          onChange={(e) => setGuarantor2(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                        >
                          <option value="">-- Select Co-signer 2 --</option>
                          {members
                            .filter(m => m.id !== currentUserId && m.userId !== currentUserId && m.id !== guarantor1 && m.id !== guarantor3)
                            .sort((a, b) => {
                              const aOnline = a.lastSeen && (Date.now() - new Date(a.lastSeen).getTime() < 180000) ? 1 : 0;
                              const bOnline = b.lastSeen && (Date.now() - new Date(b.lastSeen).getTime() < 180000) ? 1 : 0;
                              return bOnline - aOnline;
                            })
                            .map(m => {
                              const savings = Math.max(getMemberApprovedSavings(m.userId), getMemberApprovedSavings(m.id));
                              const sharesCount = savings / (chama.sharePrice || 2000);
                              const required = (parseFloat(amount) || 0) / 3;
                              const hasEnough = !required || savings >= required;
                              const isOnline = m.lastSeen && (Date.now() - new Date(m.lastSeen).getTime() < 180000);

                              return (
                                <option key={m.id} value={m.id} disabled={!hasEnough}>
                                  {isOnline ? "🟢 [ONLINE NOW] " : "⚪ "}{m.name} ({m.role}) {isOfficer ? `— ${sharesCount.toFixed(1)} Shares (${savings.toLocaleString()} ${chama.currency})` : ""} {!hasEnough ? " ❌ (Insufficient shares)" : " ✓ Eligible"}
                                </option>
                              );
                            })}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 font-mono uppercase">Guarantor / Co-signer 3</label>
                        <select
                          required
                          value={guarantor3}
                          onChange={(e) => setGuarantor3(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                        >
                          <option value="">-- Select Co-signer 3 --</option>
                          {members
                            .filter(m => m.id !== currentUserId && m.userId !== currentUserId && m.id !== guarantor1 && m.id !== guarantor2)
                            .sort((a, b) => {
                              const aOnline = a.lastSeen && (Date.now() - new Date(a.lastSeen).getTime() < 180000) ? 1 : 0;
                              const bOnline = b.lastSeen && (Date.now() - new Date(b.lastSeen).getTime() < 180000) ? 1 : 0;
                              return bOnline - aOnline;
                            })
                            .map(m => {
                              const savings = Math.max(getMemberApprovedSavings(m.userId), getMemberApprovedSavings(m.id));
                              const sharesCount = savings / (chama.sharePrice || 2000);
                              const required = (parseFloat(amount) || 0) / 3;
                              const hasEnough = !required || savings >= required;
                              const isOnline = m.lastSeen && (Date.now() - new Date(m.lastSeen).getTime() < 180000);

                              return (
                                <option key={m.id} value={m.id} disabled={!hasEnough}>
                                  {isOnline ? "🟢 [ONLINE NOW] " : "⚪ "}{m.name} ({m.role}) {isOfficer ? `— ${sharesCount.toFixed(1)} Shares (${savings.toLocaleString()} ${chama.currency})` : ""} {!hasEnough ? " ❌ (Insufficient shares)" : " ✓ Eligible"}
                                </option>
                              );
                            })}
                        </select>
                      </div>
                    </div>

                    {/* Auto-deduct acknowledgement checkbox */}
                    <div className="pt-2 border-t border-slate-900/60 flex items-start gap-2">
                      <input
                        type="checkbox"
                        id="autoDeductAgreement"
                        required
                        checked={agreedToAutoDeduct}
                        onChange={(e) => setAgreedToAutoDeduct(e.target.checked)}
                        className="mt-0.5 rounded border-slate-800 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-950 bg-slate-900 w-4 h-4 cursor-pointer"
                      />
                      <label htmlFor="autoDeductAgreement" className="text-[10px] text-slate-400 leading-tight select-none cursor-pointer">
                        I understand and explicitly agree to the credit rules, including auto-deduction of overdue defaults from my shares/savings.
                      </label>
                    </div>
                  </div>
                </div>

                <div className="pt-3 mt-3 flex items-center justify-end gap-3 border-t border-slate-800 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowRequestModal(false)}
                    className="px-4 py-2 text-xs font-mono text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || getMemberApprovedSavings(currentUserId) <= 0}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 px-5 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:cursor-not-allowed transition-colors shadow-md shadow-emerald-950"
                  >
                    {submitting ? "Requesting..." : getMemberApprovedSavings(currentUserId) <= 0 ? "Ineligible (0 Shares)" : "Submit Application"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Default Recovery Confirmation Modal */}
      <AnimatePresence>
        {recoveringLoan && (() => {
          const totalPayable = recoveringLoan.amount * (1 + recoveringLoan.interestRate / 100);
          const outstanding = totalPayable - recoveringLoan.amountRepaid;
          const borrowerSavings = getMemberApprovedSavings(recoveringLoan.userId);
          const borrowerShares = borrowerSavings / (chama.sharePrice || 2000);

          return (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 relative max-h-[90vh] overflow-y-auto shadow-2xl"
              >
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-amber-500 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 shrink-0" /> Execute Default Recovery
                  </h3>
                  <p className="text-xs text-slate-400">
                    Recover unpaid outstanding credit balance directly from borrower's shares
                  </p>
                </div>

                <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-900 space-y-2.5 text-xs">
                  <div className="flex justify-between border-b border-slate-900 pb-2">
                    <span className="text-slate-400 font-semibold">Borrower:</span>
                    <span className="font-bold text-white">{recoveringLoan.memberName}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1 text-[11px] font-mono">
                    <div>
                      <p className="text-slate-500 uppercase text-[9px]">Total Owed</p>
                      <p className="font-bold text-slate-300">{totalPayable.toLocaleString()} {chama.currency}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 uppercase text-[9px]">Repaid Balance</p>
                      <p className="font-bold text-emerald-400">{recoveringLoan.amountRepaid.toLocaleString()} {chama.currency}</p>
                    </div>
                  </div>

                  <div className="border-t border-slate-900 pt-2 flex justify-between items-center">
                    <span className="text-amber-400 font-semibold font-mono uppercase text-[9px]">Outstanding Balance:</span>
                    <span className="font-extrabold text-amber-400 font-mono text-sm">{outstanding.toLocaleString()} {chama.currency}</span>
                  </div>
                </div>

                <div className="p-3.5 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-2 text-xs">
                  <p className="font-mono text-[10px] text-amber-400 font-extrabold uppercase">Member Assets Check</p>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Total Savings Balance:</span>
                    <span className="font-semibold text-slate-200">{borrowerSavings.toLocaleString()} {chama.currency}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Total Shares Value:</span>
                    <span className="font-semibold text-emerald-400">{borrowerShares.toFixed(1)} Units</span>
                  </div>
                  <div className="pt-2 border-t border-slate-900/60 text-[10px] text-slate-400 leading-relaxed">
                    ⚠ Warning: Executing recovery will deduct exactly <strong className="text-white">{outstanding.toLocaleString()} {chama.currency}</strong> from this member's shares, and instantly close the loan as <strong className="text-emerald-400">Repaid</strong>.
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setRecoveringLoan(null)}
                    className="px-4 py-2 text-xs font-mono text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={recovering}
                    onClick={() => handleRecoverFromShares(recoveringLoan)}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                  >
                    {recovering ? "Processing..." : "Deduct and Settle"}
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
