import React, { useState, useEffect } from "react";
import { collection, onSnapshot, doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Chama, Member } from "../types";
import { Users, Plus, Search, Landmark, Compass, CircleHelp, AlertCircle, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ChamaSelectorProps {
  currentUser: { uid: string; displayName: string | null; email: string | null; photoURL: string | null };
  onChamaSelected: (chama: Chama) => void;
}

export default function ChamaSelector({ currentUser, onChamaSelected }: ChamaSelectorProps) {
  const [chamas, setChamas] = useState<Chama[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [memberships, setMemberships] = useState<Record<string, boolean>>({});

  // Form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("KES");
  const [frequency, setFrequency] = useState<"weekly" | "monthly" | "custom">("monthly");
  const [contributionAmount, setContributionAmount] = useState(1000);
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to all Chamas
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "chamas"),
      (snapshot) => {
        const chamaList: Chama[] = [];
        snapshot.forEach((doc) => {
          chamaList.push({ id: doc.id, ...doc.data() } as Chama);
        });
        setChamas(chamaList);
        setLoading(false);

        // Fetch memberships for each chama
        chamaList.forEach(async (chama) => {
          const mRef = doc(db, "chamas", chama.id, "members", currentUser.uid);
          const mSnap = await getDoc(mRef);
          setMemberships((prev) => ({ ...prev, [chama.id]: mSnap.exists() }));
        });
      },
      (error) => {
        console.error("Error loading chamas:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser.uid]);

  const handleCreateChama = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !description || contributionAmount <= 0) {
      setError("Please fill out all fields with valid data.");
      return;
    }

    setCreateLoading(true);
    setError(null);
    try {
      const newChamaId = "chama_" + Date.now().toString(36);
      const chamaData: Chama = {
        id: newChamaId,
        name,
        description,
        totalSavings: 0,
        totalInvestments: 0,
        totalLoans: 0,
        frequency,
        contributionAmount,
        currency,
        createdBy: currentUser.uid,
        createdAt: new Date().toISOString(),
      };

      // 1. Create the Chama document
      await setDoc(doc(db, "chamas", newChamaId), chamaData);

      // 2. Add creator as Chairperson member
      const memberData: Member = {
        id: currentUser.uid,
        userId: currentUser.uid,
        name: currentUser.displayName || currentUser.email?.split("@")[0] || "Chairperson",
        email: currentUser.email || "",
        photoURL: currentUser.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentUser.displayName || "Admin")}`,
        role: "chairperson",
        joinedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "chamas", newChamaId, "members", currentUser.uid), memberData);

      // Reset form
      setName("");
      setDescription("");
      setCurrency("KES");
      setFrequency("monthly");
      setContributionAmount(1000);
      setShowCreateModal(false);

      // Select newly created Chama
      onChamaSelected(chamaData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to create Chama.");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleQuickJoin = async (chama: Chama) => {
    try {
      const memberData: Member = {
        id: currentUser.uid,
        userId: currentUser.uid,
        name: currentUser.displayName || currentUser.email?.split("@")[0] || "New Member",
        email: currentUser.email || "",
        photoURL: currentUser.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentUser.displayName || "Member")}`,
        role: "member",
        joinedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "chamas", chama.id, "members", currentUser.uid), memberData);
      setMemberships((prev) => ({ ...prev, [chama.id]: true }));
      onChamaSelected(chama);
    } catch (err) {
      console.error("Error joining chama:", err);
    }
  };

  const filteredChamas = chamas.filter((chama) =>
    (chama.name || "").toLowerCase().includes((searchQuery || "").toLowerCase()) ||
    (chama.description || "").toLowerCase().includes((searchQuery || "").toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative">
      <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.02] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between border-b border-slate-900 gap-4">
        <div className="flex items-center gap-3 self-start">
          <div className="p-2.5 bg-emerald-950/50 border border-emerald-500/30 rounded-xl text-emerald-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Chama Ledger</h1>
            <p className="text-xs text-slate-500 font-mono">SELECT OR EXPLORE GROUPS</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search group..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900/60 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm w-full sm:w-64 focus:outline-none focus:border-emerald-500/50 text-white font-sans"
            />
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-colors shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" /> Create Group
          </button>
        </div>
      </header>

      {/* Main Directory Area */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-6 py-10 space-y-8">
        
        {/* Banner callout */}
        <div className="p-6 bg-gradient-to-r from-emerald-950/40 to-slate-900/40 border border-emerald-950/50 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm font-mono">
              <Sparkles className="w-4 h-4" /> Discover Your Local Savings Union
            </div>
            <p className="text-sm text-slate-400 max-w-2xl font-sans">
              Welcome, <span className="text-white font-semibold">{currentUser.displayName || currentUser.email?.split("@")[0] || "Guest"}</span>.
              Explore existing Chama cooperatives below to join, participate in rotational savings, 
              or create a fresh local group to manage investments and micro-credits with your partners.
            </p>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] text-slate-500 bg-slate-900/60 border border-slate-800 px-3.5 py-1.5 rounded-lg shrink-0">
            <Landmark className="w-4 h-4 text-emerald-500" /> FIREBASE SYNC ACTIVE
          </div>
        </div>

        {/* Directory Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-mono text-slate-500 uppercase tracking-widest">
            {searchQuery ? "Search Results" : "All Active Cooperatives"} ({filteredChamas.length})
          </h3>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-48 bg-slate-900/30 border border-slate-900 animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : filteredChamas.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/10 border border-slate-900 rounded-2xl space-y-3">
              <Compass className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-slate-400 font-medium">No Chama groups found matching your search</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="text-emerald-400 font-mono text-sm underline hover:text-emerald-300 cursor-pointer"
              >
                Create the first Chama group now
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredChamas.map((chama) => {
                const isMember = memberships[chama.id] || chama.createdBy === currentUser.uid;
                
                return (
                  <motion.div
                    key={chama.id}
                    layoutId={chama.id}
                    className="p-6 bg-slate-900/40 border border-slate-900 hover:border-slate-800/80 rounded-2xl space-y-5 hover:bg-slate-900/60 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <h4 className="text-lg font-bold text-white group-hover:text-emerald-400 line-clamp-1">
                          {chama.name}
                        </h4>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                          isMember 
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                            : "bg-slate-800 text-slate-400 border border-slate-700/60"
                        }`}>
                          {isMember ? "MEMBER" : "PUBLIC"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2 h-8">
                        {chama.description}
                      </p>

                      {/* Period Rates */}
                      <div className="pt-2 grid grid-cols-2 gap-4 border-t border-slate-900">
                        <div>
                          <p className="text-[10px] text-slate-500 font-mono uppercase">Frequency</p>
                          <p className="text-xs font-semibold text-slate-200 capitalize">{chama.frequency}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 font-mono uppercase">Target Saving</p>
                          <p className="text-xs font-semibold text-emerald-400">
                            {chama.contributionAmount.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">{chama.currency}</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 flex items-center justify-between gap-3 border-t border-slate-900/60">
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Users className="w-3.5 h-3.5 text-slate-600" />
                        <span>Pooled Capital Group</span>
                      </div>
                      {isMember ? (
                        <button
                          onClick={() => onChamaSelected(chama)}
                          className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-750 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Enter Chama →
                        </button>
                      ) : (
                        <button
                          onClick={() => handleQuickJoin(chama)}
                          className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                        >
                          Quick Join & Enter
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Creation Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-6 relative overflow-hidden"
            >
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-emerald-500" /> Form a New Cooperative
                </h3>
                <p className="text-xs text-slate-400">
                  You will automatically become the group Chairperson
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-950/50 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleCreateChama} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-mono">Chama Group Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Upendo Savings Group"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-mono">Group Purpose / Description</label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Describe group goals, bylaws, fine structures..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-mono">Currency</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                    >
                      <option value="KES">KES (KSh)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="UGX">UGX (USh)</option>
                      <option value="TZS">TZS (TSh)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-mono">Frequency</label>
                    <select
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="custom">Custom Rotation</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-mono">Target Contribution per Period</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={contributionAmount}
                    onChange={(e) => setContributionAmount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-xs font-mono text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                  >
                    {createLoading ? "Creating..." : "Form Group"}
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
