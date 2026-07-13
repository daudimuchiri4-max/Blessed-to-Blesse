import React, { useState, useEffect } from "react";
import { collection, onSnapshot, doc, addDoc, updateDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { Chama, Investment, Member } from "../types";
import { Plus, TrendingUp, Landmark, ShieldCheck, DollarSign, Calendar, Edit2, AlertCircle, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface InvestmentsTabProps {
  chama: Chama;
  currentUserId: string;
  memberRole: Member["role"] | null;
}

export default function InvestmentsTab({ chama, currentUserId, memberRole }: InvestmentsTabProps) {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal / Form states (Add)
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amountInvested, setAmountInvested] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [expectedReturn, setExpectedReturn] = useState("");
  const [dateAcquired, setDateAcquired] = useState(new Date().toISOString().split("T")[0]);
  const [status, setStatus] = useState<Investment["status"]>("active");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal / Form states (Edit Valuation)
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);
  const [newValuation, setNewValuation] = useState("");
  const [newStatus, setNewStatus] = useState<Investment["status"]>("active");

  const isAdmin = memberRole === "super_admin" || memberRole === "chairperson" || chama.createdBy === currentUserId;

  // Real-time subscribe to investments
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "chamas", chama.id, "investments"),
      (snapshot) => {
        const list: Investment[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Investment);
        });
        setInvestments(list);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading investments:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [chama.id]);

  // Recalculates and updates the parent Chama's totalInvestments field based on all investments
  const syncParentTotalInvestments = async () => {
    try {
      const snap = await getDocs(collection(db, "chamas", chama.id, "investments"));
      let totalValuation = 0;
      snap.forEach((doc) => {
        const inv = doc.data() as Investment;
        if (inv.status !== "liquidated") {
          totalValuation += inv.currentValue;
        }
      });
      await updateDoc(doc(db, "chamas", chama.id), {
        totalInvestments: totalValuation,
      });
    } catch (err) {
      console.error("Error syncing total investments:", err);
    }
  };

  const handleAddInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    const cost = parseFloat(amountInvested);
    const value = parseFloat(currentValue || amountInvested); // Default to cost if not provided

    if (!title || isNaN(cost) || cost <= 0 || isNaN(value) || value < 0) {
      setError("Please fill out all required fields with valid positive numbers.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const investmentData: Omit<Investment, "id"> = {
        title,
        description,
        amountInvested: cost,
        currentValue: value,
        expectedReturn,
        dateAcquired,
        status,
        notes,
        createdBy: currentUserId,
      };

      await addDoc(collection(db, "chamas", chama.id, "investments"), investmentData);
      
      // Sync the parent Chama's aggregated investments
      await syncParentTotalInvestments();

      // Reset
      setTitle("");
      setDescription("");
      setAmountInvested("");
      setCurrentValue("");
      setExpectedReturn("");
      setDateAcquired(new Date().toISOString().split("T")[0]);
      setStatus("active");
      setNotes("");
      setShowAddModal(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to create investment entry.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateValuation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvestment) return;

    const val = parseFloat(newValuation);
    if (isNaN(val) || val < 0) {
      setError("Please enter a valid valuation.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await updateDoc(doc(db, "chamas", chama.id, "investments", selectedInvestment.id), {
        currentValue: val,
        status: newStatus,
      });

      // Sync with parent Chama
      await syncParentTotalInvestments();

      setShowEditModal(false);
      setSelectedInvestment(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to update valuation.");
    } finally {
      setSubmitting(false);
    }
  };

  const openValuationEditor = (inv: Investment) => {
    setSelectedInvestment(inv);
    setNewValuation(inv.currentValue.toString());
    setNewStatus(inv.status);
    setShowEditModal(true);
  };

  // Calculations
  const totalBookCost = investments.reduce((sum, i) => sum + i.amountInvested, 0);
  const currentTotalValuation = investments.reduce((sum, i) => i.status !== "liquidated" ? sum + i.currentValue : sum, 0);
  const totalReturnPercent = totalBookCost > 0 
    ? ((currentTotalValuation - totalBookCost) / totalBookCost) * 100 
    : 0;

  return (
    <div className="space-y-6 font-sans">
      
      {/* Header and Add Row */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white">Chama Asset Portfolio</h3>
          <p className="text-xs text-slate-500">Acquire mutual properties, manage funds, and evaluate book values.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4 stroke-[3]" /> Add Portfolio Asset
          </button>
        )}
      </div>

      {/* Portfolio Quick Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-xl space-y-1">
          <p className="text-[10px] text-slate-500 font-mono uppercase">Total Invested Capital (Cost)</p>
          <p className="text-xl font-bold text-white">{totalBookCost.toLocaleString()} {chama.currency}</p>
        </div>
        <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-xl space-y-1">
          <p className="text-[10px] text-slate-500 font-mono uppercase">Current Portfolio Valuation</p>
          <p className="text-xl font-bold text-emerald-400">{currentTotalValuation.toLocaleString()} {chama.currency}</p>
        </div>
        <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-xl space-y-1">
          <p className="text-[10px] text-slate-500 font-mono uppercase">Net Valuation Growth (%)</p>
          <p className={`text-xl font-bold ${totalReturnPercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {totalReturnPercent >= 0 ? "+" : ""}{totalReturnPercent.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Main Asset Directory */}
      <div className="p-6 bg-slate-900/40 border border-slate-900 rounded-2xl space-y-4">
        <h4 className="text-sm font-bold text-white font-mono uppercase tracking-wider border-b border-slate-900 pb-3">
          Registered Investments ({investments.length})
        </h4>

        {loading ? (
          <div className="space-y-4 py-6">
            {[1, 2].map((i) => (
              <div key={i} className="h-28 bg-slate-900/20 border border-slate-900/60 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : investments.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs font-mono space-y-3">
            <Landmark className="w-8 h-8 text-slate-700 mx-auto" />
            <p>No investments logged. Begin adding mutual assets to grow pool capital.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {investments.map((inv) => {
              const gainLoss = inv.currentValue - inv.amountInvested;
              const gainPercent = ((inv.currentValue - inv.amountInvested) / inv.amountInvested) * 100;

              return (
                <div 
                  key={inv.id} 
                  className="p-5 bg-slate-950/40 border border-slate-900 rounded-xl flex flex-col justify-between gap-4 hover:border-slate-800 transition-all text-xs"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h5 className="font-bold text-white text-sm">{inv.title}</h5>
                        <p className="text-[10px] text-slate-500 font-mono">ACQUIRED: {new Date(inv.dateAcquired).toLocaleDateString()}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                        inv.status === "active" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" :
                        inv.status === "matured" ? "bg-blue-500/15 text-blue-400 border border-blue-500/20" :
                        "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}>
                        {inv.status}
                      </span>
                    </div>

                    <p className="text-slate-400 leading-relaxed text-[11px]">
                      {inv.description || "No description provided."}
                    </p>

                    {inv.expectedReturn && (
                      <div className="text-[10px] text-emerald-400 bg-emerald-950/20 border border-emerald-900/30 px-2.5 py-1 rounded font-mono inline-block">
                        Expected Return: {inv.expectedReturn}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-900 pt-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-slate-500 font-mono uppercase">Acquisition Cost</p>
                      <p className="font-mono text-slate-300 font-semibold">{inv.amountInvested.toLocaleString()} {chama.currency}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 font-mono uppercase">Current Valuation</p>
                      <p className="font-mono text-emerald-400 font-extrabold flex items-center gap-1">
                        {inv.currentValue.toLocaleString()} {chama.currency}
                        {isAdmin && (
                          <button 
                            onClick={() => openValuationEditor(inv)}
                            className="p-1 bg-slate-900 border border-slate-800 rounded hover:border-slate-700 text-slate-400 hover:text-white cursor-pointer"
                            title="Update Valuation"
                          >
                            <Edit2 className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </p>
                    </div>
                  </div>

                  {inv.status !== "liquidated" && (
                    <div className="pt-2 flex items-center justify-between text-[10px] font-mono border-t border-slate-900/50">
                      <span className="text-slate-500">Asset Yield</span>
                      <span className={gainLoss >= 0 ? "text-emerald-400" : "text-red-400"}>
                        {gainLoss >= 0 ? "+" : ""}{gainLoss.toLocaleString()} ({gainPercent.toFixed(1)}%)
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Portfolio Asset Modal */}
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
                  <Landmark className="w-5 h-5 text-emerald-500" /> Log Group Asset Acquisition
                </h3>
                <p className="text-xs text-slate-400">
                  Register a mutual investment made with collective pool savings
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-950/50 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleAddInvestment} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-mono">Investment Name / Asset Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 5-Acre Land in Naivasha"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-mono">Description</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Plot No 12B, acquired with title deed on group business name."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-mono">Acquisition Cost ({chama.currency})</label>
                    <input
                      type="number"
                      required
                      min={1}
                      placeholder="e.g. 500000"
                      value={amountInvested}
                      onChange={(e) => setAmountInvested(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-mono">Current Value ({chama.currency})</label>
                    <input
                      type="number"
                      min={1}
                      placeholder="Same as cost"
                      value={currentValue}
                      onChange={(e) => setCurrentValue(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-mono">Acquisition Date</label>
                    <input
                      type="date"
                      required
                      value={dateAcquired}
                      onChange={(e) => setDateAcquired(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-mono">Investment Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="active">Active Holding</option>
                      <option value="matured">Matured / Holding</option>
                      <option value="liquidated">Liquidated (Sold)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-mono">Expected Return Rate / Yield Remarks</label>
                  <input
                    type="text"
                    placeholder="e.g. 12% annually, 20% land growth"
                    value={expectedReturn}
                    onChange={(e) => setExpectedReturn(e.target.value)}
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
                    {submitting ? "Saving..." : "Add Asset"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Valuation Modal */}
      <AnimatePresence>
        {showEditModal && selectedInvestment && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-5 relative"
            >
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-500" /> Revalue "{selectedInvestment.title}"
                </h3>
                <p className="text-xs text-slate-400">
                  Adjust market value and operational state of the asset.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-950/50 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleUpdateValuation} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-mono">Current Book Value ({chama.currency})</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={newValuation}
                    onChange={(e) => setNewValuation(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-mono">Asset Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="active">Active Holding</option>
                    <option value="matured">Matured / Closed</option>
                    <option value="liquidated">Liquidated (Sold)</option>
                  </select>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedInvestment(null);
                    }}
                    className="px-4 py-2 text-xs font-mono text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                  >
                    {submitting ? "Updating..." : "Update Asset"}
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
