import { useEffect, useState } from "react";
import { collection, query, limit, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { Chama, Contribution, Investment, Loan, Member } from "../types";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie } from "recharts";
import { TrendingUp, Landmark, ShieldCheck, DollarSign, Wallet, ArrowDownRight, ArrowUpRight, Activity, Calendar, Search, Award, Sparkles, Users } from "lucide-react";
import { motion } from "motion/react";

interface DashboardTabProps {
  chama: Chama;
  currentUserId: string;
}

export default function DashboardTab({ chama, currentUserId }: DashboardTabProps) {
  const [recentContributions, setRecentContributions] = useState<Contribution[]>([]);
  const [recentLoans, setRecentLoans] = useState<Loan[]>([]);
  const [allContributions, setAllContributions] = useState<Contribution[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [members, setMembers] = useState<Member[]>([]);
  const [myMemberRecord, setMyMemberRecord] = useState<Member | null>(null);
  const [dashboardMode, setDashboardMode] = useState<"portal" | "analytics">("portal");
  const [searchMemberQuery, setSearchMemberQuery] = useState("");

  // Load dashboard overview data in real-time
  useEffect(() => {
    // 1. Members count and full directory subscription
    const unsubscribeMembers = onSnapshot(
      collection(db, "chamas", chama.id, "members"),
      (snapshot) => {
        const list: Member[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Member);
        });
        setMembers(list);
        setMemberCount(list.length);

        // Find current user's role and details
        const me = list.find((m) => m.userId === currentUserId || m.id === currentUserId);
        if (me) {
          setMyMemberRecord(me);
        }
      }
    );

    // 2. Recent approved contributions
    const unsubscribeRecentContribs = onSnapshot(
      query(
        collection(db, "chamas", chama.id, "contributions"),
        orderBy("date", "desc"),
        limit(5)
      ),
      (snapshot) => {
        const list: Contribution[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Contribution);
        });
        setRecentContributions(list);
      }
    );

    // 3. All approved contributions for stats
    const unsubscribeAllContribs = onSnapshot(
      collection(db, "chamas", chama.id, "contributions"),
      (snapshot) => {
        const list: Contribution[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Contribution);
        });
        setAllContributions(list);
      }
    );

    // 4. Recent approved loans
    const unsubscribeRecentLoans = onSnapshot(
      query(
        collection(db, "chamas", chama.id, "loans"),
        orderBy("dateRequested", "desc"),
        limit(5)
      ),
      (snapshot) => {
        const list: Loan[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Loan);
        });
        setRecentLoans(list);
      }
    );

    // 5. Investments for stats
    const unsubscribeInvestments = onSnapshot(
      collection(db, "chamas", chama.id, "investments"),
      (snapshot) => {
        const list: Investment[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Investment);
        });
        setInvestments(list);
      }
    );

    return () => {
      unsubscribeMembers();
      unsubscribeRecentContribs();
      unsubscribeAllContribs();
      unsubscribeRecentLoans();
      unsubscribeInvestments();
    };
  }, [chama.id, currentUserId]);

  const isRegularMember = myMemberRecord?.role === "member";

  // Aggregate user's personal contributions
  const myTotalApproved = allContributions
    .filter((c) => c.userId === currentUserId && c.status === "approved")
    .reduce((sum, c) => sum + c.amount, 0);

  // Prepare chart data for savings over time
  // Group approved contributions by month-year
  const approvedContribs = allContributions.filter((c) => c.status === "approved" && c.type === "savings");
  const sortedContribs = [...approvedContribs].sort((a, b) => a.date.localeCompare(b.date));

  // Generate running cumulative totals by date
  let runningTotal = 0;
  const historyData = sortedContribs.map((c) => {
    runningTotal += c.amount;
    const formattedDate = new Date(c.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return {
      date: formattedDate,
      "Cumulative Savings": runningTotal,
      // For regular members, hide other members' individual contribution values from chart tooltips
      Contribution: isRegularMember ? (c.userId === currentUserId ? c.amount : null) : c.amount,
    };
  });

  // Fallback if no history exists yet
  const chartData = historyData.length > 0 ? historyData : [
    { date: "Day 1", "Cumulative Savings": 0, Contribution: 0 },
    { date: "Current", "Cumulative Savings": chama.totalSavings, Contribution: 0 }
  ];

  // Investment values distribution chart data
  const investmentData = investments.map((inv) => ({
    name: inv.title,
    value: inv.currentValue,
    cost: inv.amountInvested,
  }));

  const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6"];

  return (
    <div className="space-y-8 font-sans">
      
      {/* Interactive Tabs: Personal Portal vs Group Analytics */}
      <div className="flex border-b border-slate-900 pb-px gap-1">
        <button
          onClick={() => setDashboardMode("portal")}
          className={`px-4 py-2 text-xs font-semibold cursor-pointer transition-all border-b-2 ${
            dashboardMode === "portal"
              ? "border-emerald-500 text-emerald-400 font-bold bg-emerald-500/[0.02]"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          ✨ My Personal Portal
        </button>
        <button
          onClick={() => setDashboardMode("analytics")}
          className={`px-4 py-2 text-xs font-semibold cursor-pointer transition-all border-b-2 ${
            dashboardMode === "analytics"
              ? "border-emerald-500 text-emerald-400 font-bold bg-emerald-500/[0.02]"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          📊 Group Analytics Ledger
        </button>
      </div>

      {dashboardMode === "portal" ? (
        <div className="space-y-8">
          {/* Welcome Banner */}
          <div className="p-6 bg-slate-900/20 border border-slate-900 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img
                src={myMemberRecord?.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(myMemberRecord?.name || "Guest")}`}
                alt="Avatar"
                className="w-12 h-12 rounded-full border border-slate-800 bg-slate-950 shrink-0"
              />
              <div>
                <h4 className="text-lg font-bold text-white">Welcome to your Cooperator Portal, {myMemberRecord?.name || "Guest"}!</h4>
                <p className="text-xs text-slate-500">
                  Registered as <span className="font-mono text-emerald-400 uppercase font-bold">{myMemberRecord?.role || "member"}</span> • Member since {myMemberRecord ? new Date(myMemberRecord.joinedAt).toLocaleDateString() : "today"}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 font-mono text-[10px] text-slate-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>PORTAL LIVE SECURE CONNECTION</span>
            </div>
          </div>

          {/* Three columns: Group Wealth Summary, My Personal Standing, Chama Directory */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Column 1: Group Wealth Pool (8/12 on lg) */}
            <div className="lg:col-span-8 space-y-8">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Total Group Money Card */}
                <div className="p-5 bg-gradient-to-br from-emerald-950/20 to-slate-950/40 border border-emerald-950/40 rounded-2xl relative overflow-hidden flex flex-col justify-between h-36">
                  <div>
                    <span className="text-[10px] font-mono text-emerald-500 uppercase tracking-wider block">Total Chama Money</span>
                    <span className="text-xs text-slate-400 mt-0.5 block">{(chama.totalSavings / (chama.sharePrice || 2000)).toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})} Total Shares (@ {(chama.sharePrice || 2000).toLocaleString()} {chama.currency})</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-extrabold text-white">
                      {chama.totalSavings.toLocaleString()}
                    </h3>
                    <p className="text-[10px] text-slate-500 font-mono">CURRENCY: {chama.currency}</p>
                  </div>
                  <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
                </div>

                {/* Total Investments Card */}
                <div className="p-5 bg-gradient-to-br from-blue-950/20 to-slate-950/40 border border-blue-950/40 rounded-2xl relative overflow-hidden flex flex-col justify-between h-36">
                  <div>
                    <span className="text-[10px] font-mono text-blue-500 uppercase tracking-wider block">Asset Investments</span>
                    <span className="text-xs text-slate-400 mt-0.5 block">Cooperative Portfolio</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-extrabold text-white">
                      {chama.totalInvestments.toLocaleString()}
                    </h3>
                    <p className="text-[10px] text-slate-500 font-mono">{investments.length} Active Asset(s)</p>
                  </div>
                  <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />
                </div>

                {/* Total Members Card */}
                <div className="p-5 bg-gradient-to-br from-indigo-950/20 to-slate-950/40 border border-indigo-950/40 rounded-2xl relative overflow-hidden flex flex-col justify-between h-36">
                  <div>
                    <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-wider block">Cooperator Count</span>
                    <span className="text-xs text-slate-400 mt-0.5 block">Active Chama Trust</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-extrabold text-white">
                      {members.length}
                    </h3>
                    <p className="text-[10px] text-slate-500 font-mono">Registered members</p>
                  </div>
                  <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/5 rounded-full blur-xl pointer-events-none" />
                </div>

              </div>

              {/* Investments Quick Peek List */}
              <div className="p-6 bg-slate-900/40 border border-slate-900 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" /> Active Assets & Investments Peak
                  </h4>
                  <span className="text-[10px] font-mono text-slate-500">Chama Wealth Distribution</span>
                </div>

                {investments.length === 0 ? (
                  <p className="text-xs text-slate-500 font-mono text-center py-6">No assets registered yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {investments.map((inv) => (
                      <div key={inv.id} className="p-4 bg-slate-950/50 border border-slate-900 rounded-xl flex items-center justify-between text-xs gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-200 truncate">{inv.title}</p>
                          <p className="text-[10px] text-slate-500 font-mono truncate uppercase">{inv.category} • Cost: {inv.amountInvested.toLocaleString()} {chama.currency}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-bold text-emerald-400">{inv.currentValue.toLocaleString()} {chama.currency}</p>
                          <span className="text-[9px] font-mono text-slate-500">Valuation</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* My Personal Standing Panel */}
              <div className="p-6 bg-slate-900/40 border border-slate-900 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Activity className="w-4.5 h-4.5 text-indigo-400" /> My Standing Account Statement
                  </h4>
                  <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">Statement</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 pt-2">
                  <div className="p-4 bg-slate-950/60 border border-slate-900 rounded-xl space-y-1">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block">My Total Contributed</span>
                    <h5 className="text-base font-bold text-white">{myTotalApproved.toLocaleString()} {chama.currency}</h5>
                    <p className="text-[9px] text-slate-500">Secure Capital Ledger</p>
                  </div>

                  <div className="p-4 bg-slate-950/60 border border-slate-900 rounded-xl space-y-1">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block">My Owned Shares</span>
                    <h5 className="text-base font-bold text-emerald-400">{(myTotalApproved / (chama.sharePrice || 2000)).toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})} Shares</h5>
                    <p className="text-[9px] text-slate-500">Unit value: {(chama.sharePrice || 2000).toLocaleString()} {chama.currency}</p>
                  </div>

                  <div className="p-4 bg-slate-950/60 border border-slate-900 rounded-xl space-y-1">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block">My Ownership Share</span>
                    <h5 className="text-base font-bold text-white">
                      {((myTotalApproved / Math.max(1, chama.totalSavings)) * 100).toFixed(1)}%
                    </h5>
                    <p className="text-[9px] text-slate-500">Pool Equity Standing</p>
                  </div>

                  <div className="p-4 bg-slate-950/60 border border-slate-900 rounded-xl space-y-1">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block">Authorization Level</span>
                    <h5 className="text-base font-bold text-white uppercase font-mono text-indigo-400">
                      {myMemberRecord?.role || "Member"}
                    </h5>
                    <p className="text-[9px] text-slate-500">Full Portal Access</p>
                  </div>
                </div>
              </div>

            </div>

            {/* Column 2: Chama Directory & search (4/12 on lg) */}
            <div className="lg:col-span-4 space-y-8">
              
              <div className="p-6 bg-slate-900/40 border border-slate-900 rounded-2xl space-y-4 flex flex-col h-[524px]">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Users className="w-4.5 h-4.5 text-indigo-400" /> Active Cooperators
                  </h4>
                  <p className="text-xs text-slate-500">Full transparency directory of Chama members.</p>
                </div>

                {/* Search input */}
                <div className="relative">
                  <input
                    type="text"
                    value={searchMemberQuery}
                    onChange={(e) => setSearchMemberQuery(e.target.value)}
                    placeholder="Search cooperator..."
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/60 font-mono"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-600 absolute left-3 top-2.5" />
                </div>

                {/* Directory list scroll */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
                  {members
                    .filter((m) => m.name.toLowerCase().includes(searchMemberQuery.toLowerCase()) || m.email.toLowerCase().includes(searchMemberQuery.toLowerCase()))
                    .map((m) => {
                      const memberSavings = allContributions
                        .filter((c) => (c.userId === m.userId || c.userId === m.id) && c.type === "savings" && c.status === "approved")
                        .reduce((sum, c) => sum + c.amount, 0);
                      const memberShares = memberSavings / (chama.sharePrice || 2000);

                      return (
                        <div key={m.id} className="p-3 bg-slate-950/60 border border-slate-900/80 rounded-xl hover:border-slate-800 transition-colors space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img
                                src={m.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(m.name)}`}
                                alt={m.name}
                                className="w-8 h-8 rounded-full border border-slate-900 bg-slate-950 shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="font-bold text-slate-200 text-xs truncate">{m.name}</p>
                                <p className="text-[9px] text-slate-500 font-mono truncate">{m.email}</p>
                              </div>
                            </div>

                            <span className="shrink-0 text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-slate-900 text-slate-400 border border-slate-850">
                              {m.role}
                            </span>
                          </div>

                          {(!isRegularMember || m.userId === currentUserId || m.id === currentUserId) && (
                            <div className="pt-2 border-t border-slate-900/50 flex justify-between items-center text-[10px] font-mono text-slate-500">
                              <span>Contribution: <strong className="text-slate-300">{(memberSavings).toLocaleString()} {chama.currency}</strong></span>
                              <span>Shares: <strong className="text-emerald-400">{memberShares.toFixed(1)}</strong></span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>

                <div className="pt-3 border-t border-slate-900 text-center text-[10px] font-mono text-slate-500">
                  Total Active trust: {members.length} members
                </div>
              </div>

            </div>

          </div>

        </div>
      ) : (
        /* Analytics Mode (Original Dashboard view) */
        <div className="space-y-8">
          {/* Visual Header / Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Total Pool Savings */}
            <div className="p-6 bg-slate-900/40 border border-slate-900 rounded-2xl relative overflow-hidden flex flex-col justify-between h-40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Group Savings Pool</span>
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                  <Landmark className="w-5 h-5" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-3xl font-extrabold text-white">
                  {chama.totalSavings.toLocaleString()}
                </h3>
                <p className="text-xs text-slate-500 font-mono">CURRENCY: {chama.currency} • {(chama.totalSavings / (chama.sharePrice || 2000)).toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})} Shares</p>
              </div>
              <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3" /> Fully Audited Capital (@ {(chama.sharePrice || 2000).toLocaleString()} {chama.currency}/Share)
              </div>
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
            </div>

            {/* Active Investments */}
            <div className="p-6 bg-slate-900/40 border border-slate-900 rounded-2xl relative overflow-hidden flex flex-col justify-between h-40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Active Assets</span>
                <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-3xl font-extrabold text-white">
                  {chama.totalInvestments.toLocaleString()}
                </h3>
                <p className="text-xs text-slate-500 font-mono">{investments.length} registered asset(s)</p>
              </div>
              <div className="text-[10px] text-blue-400 font-mono flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> High Return Portfolio
              </div>
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
            </div>

            {/* Outstanding Loans */}
            <div className="p-6 bg-slate-900/40 border border-slate-900 rounded-2xl relative overflow-hidden flex flex-col justify-between h-40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">Loans Outstanding</span>
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                  <Wallet className="w-5 h-5" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-3xl font-extrabold text-white">
                  {chama.totalLoans.toLocaleString()}
                </h3>
                <p className="text-xs text-slate-500 font-mono">Issued to group members</p>
              </div>
              <div className="text-[10px] text-amber-400 font-mono flex items-center gap-1">
                <ArrowDownRight className="w-3 h-3" /> Micro-Credit Yielding Interest
              </div>
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
            </div>

            {/* My Personal Contributions */}
            <div className="p-6 bg-slate-900/40 border border-slate-900 rounded-2xl relative overflow-hidden flex flex-col justify-between h-40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">My Approved Savings</span>
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-3xl font-extrabold text-white">
                  {myTotalApproved.toLocaleString()}
                </h3>
                <p className="text-xs text-slate-500 font-mono">YOUR TOTAL • {(myTotalApproved / (chama.sharePrice || 2000)).toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})} Shares</p>
              </div>
              <div className="text-[10px] text-indigo-400 font-mono flex items-center gap-1">
                <Activity className="w-3.5 h-3.5" /> 100% Personal Share
              </div>
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
            </div>
          </div>

          {/* Main Grid: Charts & Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Side: Savings Growth Area Chart */}
            <div className="lg:col-span-8 p-6 bg-slate-900/40 border border-slate-900 rounded-2xl space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h4 className="font-bold text-white text-base">Savings Growth & Flow</h4>
                  <p className="text-xs text-slate-500">Cumulative regular group savings ledger timeline</p>
                </div>
                <div className="flex items-center gap-2 font-mono text-[10px] text-slate-400 bg-slate-950/60 border border-slate-900 px-3 py-1.5 rounded-lg">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" /> LIVE STATS
                </div>
              </div>

              <div className="h-72 w-full text-xs font-mono">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px", color: "#f8fafc" }}
                      labelStyle={{ color: "#94a3b8" }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="Cumulative Savings" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorSavings)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Right Side: Investment Distribution Pie Chart */}
            <div className="lg:col-span-4 p-6 bg-slate-900/40 border border-slate-900 rounded-2xl space-y-6 flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-white text-base">Asset Diversification</h4>
                <p className="text-xs text-slate-500">Current market valuation share of investments</p>
              </div>

              {investmentData.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-2">
                  <Landmark className="w-10 h-10 text-slate-700" />
                  <p className="text-xs text-slate-400 font-medium">No assets registered yet</p>
                  <p className="text-[10px] text-slate-500">Use the Investments tab to log properties, group trades, or funds.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="h-44 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={investmentData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {investmentData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px", color: "#f8fafc" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Legend with values */}
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {investmentData.map((entry, index) => (
                      <div key={entry.name} className="flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                          <span className="text-slate-400 truncate max-w-[120px]">{entry.name}</span>
                        </div>
                        <span className="text-slate-200 font-semibold">{entry.value.toLocaleString()} {chama.currency}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Grid: Recent Ledgers & Transactions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Recent Contributions Activity */}
            <div className="p-6 bg-slate-900/40 border border-slate-900 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <Activity className="w-4.5 h-4.5 text-emerald-400" /> Recent Contribution Stream
                </h4>
                <span className="text-[10px] font-mono text-slate-500">Verification Feed</span>
              </div>

              <div className="space-y-3">
                {recentContributions.filter((c) => !isRegularMember || c.userId === currentUserId).length === 0 ? (
                  <p className="text-xs text-slate-500 font-mono text-center py-6">No contributions logged yet.</p>
                ) : (
                  recentContributions
                    .filter((c) => !isRegularMember || c.userId === currentUserId)
                    .map((c) => (
                      <div key={c.id} className="p-3 bg-slate-950/40 border border-slate-900 rounded-xl flex items-center justify-between text-xs gap-3">
                        <div>
                          <p className="font-semibold text-slate-200">{c.memberName}</p>
                          <p className="text-[10px] text-slate-500 font-mono uppercase">{c.type} • {new Date(c.date).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-bold text-slate-100">+{c.amount.toLocaleString()} {chama.currency}</p>
                          <span className={`inline-block text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                            c.status === "approved" ? "bg-emerald-500/10 text-emerald-400" :
                            c.status === "pending" ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400"
                          }`}>
                            {c.status}
                          </span>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Recent Loan Approvals */}
            <div className="p-6 bg-slate-900/40 border border-slate-900 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <Wallet className="w-4.5 h-4.5 text-amber-400" /> Member Loan Applications
                </h4>
                <span className="text-[10px] font-mono text-slate-500">Credit Ledger</span>
              </div>

              <div className="space-y-3">
                {recentLoans.length === 0 ? (
                  <p className="text-xs text-slate-500 font-mono text-center py-6">No loans requested yet.</p>
                ) : (
                  recentLoans.map((l) => (
                    <div key={l.id} className="p-3 bg-slate-950/40 border border-slate-900 rounded-xl flex items-center justify-between text-xs gap-3">
                      <div>
                        <p className="font-semibold text-slate-200">{l.memberName}</p>
                        <p className="text-[10px] text-slate-500 font-mono uppercase">
                          Term: {l.repaymentTermMonths} mo • Interest: {l.interestRate}%
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold text-amber-400">{l.amount.toLocaleString()} {chama.currency}</p>
                        <span className={`inline-block text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                          l.status === "active" || l.status === "approved" ? "bg-emerald-500/10 text-emerald-400" :
                          l.status === "pending" ? "bg-amber-500/10 text-amber-400" :
                          l.status === "repaid" ? "bg-blue-500/10 text-blue-400" : "bg-red-500/10 text-red-400"
                        }`}>
                          {l.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
