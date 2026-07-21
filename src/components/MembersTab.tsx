import React, { useState, useEffect } from "react";
import { collection, onSnapshot, doc, updateDoc, setDoc, getDocs, query, where, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Chama, Member, Contribution } from "../types";
import { 
  Users, 
  Shield, 
  Award, 
  Calendar, 
  ChevronDown, 
  UserCheck, 
  Plus, 
  X, 
  AlertCircle, 
  ShieldAlert, 
  Sparkles, 
  HelpCircle, 
  Check, 
  UserPlus, 
  Mail, 
  BookOpen, 
  Info,
  Edit2,
  Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface MembersTabProps {
  chama: Chama;
  currentUserId: string;
  memberRole: Member["role"] | null;
}

export default function MembersTab({ chama, currentUserId, memberRole }: MembersTabProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal & form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMatrix, setShowMatrix] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<Member["role"]>("member");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit & Delete states
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [deletingMember, setDeletingMember] = useState<Member | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<Member["role"]>("member");

  const isAdmin = memberRole === "super_admin" || memberRole === "chairperson" || chama.createdBy === currentUserId;
  const isSecretary = memberRole === "secretary";
  const isOfficer = isAdmin || isSecretary || memberRole === "treasurer" || memberRole === "vice_chairperson";

  const handleOpenEdit = (m: Member) => {
    setEditingMember(m);
    setEditName(m.name);
    setEditEmail(m.email);
    setEditRole(m.role);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    try {
      await updateDoc(doc(db, "chamas", chama.id, "members", editingMember.id), {
        name: editName.trim(),
        email: editEmail.trim().toLowerCase(),
        role: editRole,
      });
      setEditingMember(null);
    } catch (err: any) {
      console.error("Error editing member:", err);
      alert("Failed to update member: " + err.message);
    }
  };

  const handleDeleteMember = async () => {
    if (!deletingMember) return;
    try {
      await deleteDoc(doc(db, "chamas", chama.id, "members", deletingMember.id));
      setDeletingMember(null);
    } catch (err: any) {
      console.error("Error deleting member:", err);
      alert("Failed to delete member: " + err.message);
    }
  };

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
        // Sort: chairperson first, then secretary, then vice_chairperson, then treasurer, then member
        const roleOrder = { chairperson: 0, secretary: 1, vice_chairperson: 2, treasurer: 3, member: 4 };
        list.sort((a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9));
        setMembers(list);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading members:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [chama.id]);

  // Real-time subscribe to contributions to calculate member shares
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
        console.error("Error loading contributions for members tab:", error);
      }
    );
    return () => unsubscribe();
  }, [chama.id]);

  const handleChangeRole = async (memberId: string, newRole: Member["role"]) => {
    try {
      await updateDoc(doc(db, "chamas", chama.id, "members", memberId), {
        role: newRole,
      });
    } catch (err) {
      console.error("Error updating member role:", err);
    }
  };

  const handleAddMemberManually = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !newMemberEmail.trim()) {
      setError("Please specify both a name and a valid email.");
      return;
    }

    const emailClean = newMemberEmail.trim().toLowerCase();

    // Check if duplicate email in current state list
    const isDuplicate = members.some((m) => m.email.toLowerCase() === emailClean);
    if (isDuplicate) {
      setError("This email address is already registered as a member of this Chama.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // Create a deterministic or unique ID for the manual member entry
      const membersCollRef = collection(db, "chamas", chama.id, "members");
      const newMemberRef = doc(membersCollRef); // Generates a unique doc ID

      const manualMemberData: Member = {
        id: newMemberRef.id,
        userId: newMemberRef.id, // placeholder until first login upgrades it
        name: newMemberName.trim(),
        email: emailClean,
        photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(newMemberName.trim())}`,
        role: newMemberRole,
        joinedAt: new Date().toISOString(),
        isPending: true, // indicates pending first login
      };

      await setDoc(newMemberRef, manualMemberData);

      setSuccess(`Cooperator "${newMemberName}" added successfully as ${newMemberRole}!`);
      setNewMemberName("");
      setNewMemberEmail("");
      setNewMemberRole("member");
      
      // Auto close after brief delay
      setTimeout(() => {
        setShowAddModal(false);
        setSuccess(null);
      }, 2000);
    } catch (err: any) {
      console.error("Error adding member manually:", err);
      setError(err.message || "Failed to add member. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleIcon = (role: Member["role"]) => {
    switch (role) {
      case "super_admin":
        return <ShieldAlert className="w-4 h-4 text-rose-400" />;
      case "chairperson":
        return <Shield className="w-4 h-4 text-emerald-400" />;
      case "vice_chairperson":
        return <Shield className="w-4 h-4 text-teal-400" />;
      case "treasurer":
        return <Award className="w-4 h-4 text-blue-400" />;
      case "secretary":
        return <UserCheck className="w-4 h-4 text-indigo-400" />;
      default:
        return <Users className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white">Chama Cooperators & Trustees</h3>
          <p className="text-xs text-slate-500">View registered group participants, manage corporate officers, and assign roles.</p>
        </div>
        
        <div className="flex items-center gap-2 self-stretch md:self-auto">
          <button
            onClick={() => setShowMatrix(!showMatrix)}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
          >
            <BookOpen className="w-4 h-4" /> Role Permissions
          </button>

          {isOfficer && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors"
            >
              <UserPlus className="w-4 h-4" /> Add Member Manually
            </button>
          )}
        </div>
      </div>

      {/* Expandable Roles & Permissions Matrix Card */}
      <AnimatePresence>
        {showMatrix && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-6 bg-slate-900/40 border border-slate-900 rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                <h4 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                  <ShieldAlert className="w-4.5 h-4.5 text-emerald-400" /> Executive Authority & Roles Guide
                </h4>
                <button 
                  onClick={() => setShowMatrix(false)}
                  className="text-slate-500 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {/* Super Admin */}
                <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-rose-400 text-xs font-mono uppercase">
                    <ShieldAlert className="w-4 h-4" /> Super Admin
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    System-wide controller. Possesses ultimate master privileges to configure settings, verify compliance protocols, and audit structural system states.
                  </p>
                </div>

                {/* Chairperson */}
                <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-400 text-xs font-mono uppercase">
                    <Shield className="w-4 h-4" /> Chairperson
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Executive moderator. Governs group strategy, registers agenda metrics, promotes committee trustees, and reviews overall credit loan applications.
                  </p>
                </div>

                {/* Vice Chairperson */}
                <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-teal-400 text-xs font-mono uppercase">
                    <Shield className="w-4 h-4" /> Vice Chair
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Executive support. Assists the Chairperson in operational leadership and exercises full chairperson authorities in their absence.
                  </p>
                </div>

                {/* Secretary */}
                <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-400 text-xs font-mono uppercase">
                    <UserCheck className="w-4 h-4" /> Secretary
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    General records. Manages active directory listings, schedules weekly/monthly assembly schedules, and curates transaction statements.
                  </p>
                </div>

                {/* Treasurer */}
                <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-blue-400 text-xs font-mono uppercase">
                    <Award className="w-4 h-4" /> Treasurer
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Financial custodian. <span className="text-blue-300 font-semibold">Exclusively authorized to approve and reject contribution payments</span> matching bank statements.
                  </p>
                </div>

                {/* Regular Member */}
                <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-slate-400 text-xs font-mono uppercase">
                    <Users className="w-4 h-4" /> Member
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Standard cooperator. Consistently submits savings pool deposits, applies for microloans, and participates in group investment growth.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Members Directory Card */}
      <div className="p-6 bg-slate-900/40 border border-slate-900 rounded-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-900 pb-3">
          <h4 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
            Registered Cooperators ({members.length})
          </h4>
          <span className="text-[10px] font-mono text-slate-500">Live directory</span>
        </div>

        {loading ? (
          <div className="space-y-3 py-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-slate-900/20 border border-slate-900/60 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {members.map((m) => (
              <div 
                key={m.id} 
                className="p-4 bg-slate-950/40 border border-slate-900 rounded-xl flex flex-col justify-between gap-4 hover:border-slate-800 transition-all text-xs relative group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={m.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(m.name)}`}
                      alt={m.name}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full border border-slate-800 bg-slate-900 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h5 className="font-bold text-slate-200 text-sm truncate max-w-[110px]">{m.name}</h5>
                        
                        {m.userId === currentUserId && (
                          <span className="text-[9px] font-mono px-1 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded">YOU</span>
                        )}

                        {m.isPending && (
                          <span className="text-[8px] font-mono px-1 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/20 rounded font-bold uppercase tracking-wider">
                            PENDING
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono truncate">{m.email}</p>
                    </div>
                  </div>

                  {/* Actions: Edit / Delete */}
                  {isAdmin && (
                    <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenEdit(m)}
                        className="p-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-emerald-400 rounded transition-all cursor-pointer"
                        title="Edit Cooperator"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      {m.userId !== currentUserId && (
                        <button
                          onClick={() => setDeletingMember(m)}
                          className="p-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-red-400 rounded transition-all cursor-pointer"
                          title="Remove Cooperator"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {(() => {
                  const memberSavings = contributions
                    .filter((c) => (c.userId === m.userId || c.userId === m.id) && c.type === "savings" && c.status === "approved")
                    .reduce((sum, c) => sum + c.amount, 0);
                  const memberShares = memberSavings / (chama.sharePrice || 2000);

                  const isMe = m.userId === currentUserId || m.id === currentUserId;
                  const isRegularMember = memberRole === "member";

                  if (isRegularMember && !isMe) {
                    return (
                      <div className="bg-slate-950/30 border border-slate-900/60 p-2.5 rounded-xl flex items-center justify-between text-[10px] font-mono text-slate-500">
                        <span>Savings & Shares:</span>
                        <span className="text-[9px] bg-slate-900/60 px-1.5 py-0.5 rounded text-slate-500 uppercase font-bold tracking-wider">Confidential</span>
                      </div>
                    );
                  }

                  return (
                    <div className="bg-slate-950/50 border border-slate-900/60 p-2.5 rounded-xl flex items-center justify-between text-[10px] font-mono">
                      <div className="space-y-0.5">
                        <span className="text-slate-500 block text-[9px] uppercase">Savings Pool</span>
                        <strong className="text-slate-300 font-mono text-xs">{memberSavings.toLocaleString()} {chama.currency}</strong>
                      </div>
                      <div className="text-right space-y-0.5">
                        <span className="text-slate-500 block text-[9px] uppercase">Owned Shares</span>
                        <strong className="text-emerald-400 text-xs font-bold">{memberShares.toFixed(1)} Units</strong>
                      </div>
                    </div>
                  );
                })()}

                <div className="pt-3 border-t border-slate-900 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400 uppercase">
                    {getRoleIcon(m.role)}
                    <span className="font-semibold">{m.role}</span>
                  </div>

                  {/* Role Promotion - only chairperson (or group creator) can change roles */}
                  {isAdmin && m.userId !== currentUserId ? (
                    <div className="relative">
                      <select
                        value={m.role}
                        onChange={(e) => handleChangeRole(m.id, e.target.value as any)}
                        className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-[10px] font-mono font-medium text-slate-300 focus:outline-none appearance-none pr-6 hover:border-slate-700 hover:text-white cursor-pointer"
                      >
                        <option value="member">Set Regular Member</option>
                        <option value="treasurer">Set Treasurer</option>
                        <option value="secretary">Set Secretary</option>
                        <option value="vice_chairperson">Set Vice Chairperson</option>
                        <option value="chairperson">Set Chairperson</option>
                        <option value="super_admin">Set Super Admin</option>
                      </select>
                      <ChevronDown className="w-3 h-3 text-slate-500 absolute right-2 top-2 pointer-events-none" />
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{m.isPending ? "Created" : "Joined"}: {new Date(m.joinedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual Member Registration Modal */}
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
                  <UserPlus className="w-5 h-5 text-emerald-500" /> Register Cooperator Manually
                </h3>
                <p className="text-xs text-slate-400">
                  Pre-register members by email. When they sign up or log in, their account will merge automatically.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-950/50 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="p-3 bg-emerald-950/50 border border-emerald-500/30 rounded-lg text-xs text-emerald-400 flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0 stroke-[3]" />
                  <span>{success}</span>
                </div>
              )}

              <form onSubmit={handleAddMemberManually} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-mono">Full Name</label>
                  <input
                    type="text"
                    required
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. Jane Doe"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-mono">Email Address</label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={newMemberEmail}
                      onChange={(e) => setNewMemberEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                      placeholder="e.g. jane.doe@example.com"
                    />
                    <Mail className="w-4 h-4 text-slate-600 absolute left-3 top-2.5" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-mono">Cooperative Role & Authority</label>
                  <select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="member">Regular Member</option>
                    <option value="treasurer">Treasurer</option>
                    <option value="secretary">Secretary</option>
                    <option value="vice_chairperson">Vice Chairperson</option>
                    <option value="chairperson">Chairperson</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-855 rounded-xl text-[10px] text-slate-400 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <span className="text-slate-200 font-semibold">Security Note:</span> An avatar based on their initials will be auto-generated. Upon logging in with Google, their profile photo will automatically update.
                  </p>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setError(null);
                      setSuccess(null);
                    }}
                    className="px-4 py-2 text-xs font-mono text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center gap-1"
                  >
                    {submitting ? "Registering..." : "Add Cooperator"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Cooperator Modal */}
      <AnimatePresence>
        {editingMember && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 relative"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Edit2 className="w-5 h-5 text-emerald-400" /> Edit Cooperator Details
                </h3>
                <button 
                  onClick={() => setEditingMember(null)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-mono">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-mono">Email Address</label>
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-mono">Cooperative Role & Authority</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="member">Regular Member</option>
                    <option value="treasurer">Treasurer</option>
                    <option value="secretary">Secretary</option>
                    <option value="vice_chairperson">Vice Chairperson</option>
                    <option value="chairperson">Chairperson</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingMember(null)}
                    className="px-4 py-2 text-xs font-mono text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Cooperator Confirmation Modal */}
      <AnimatePresence>
        {deletingMember && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-5 relative"
            >
              <div className="space-y-3 text-center">
                <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto text-red-400">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Remove Cooperator?</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Are you sure you want to remove <span className="text-slate-200 font-semibold">{deletingMember.name}</span> from the Chama directory? This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setDeletingMember(null)}
                  className="px-4 py-2 text-xs font-mono text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteMember}
                  className="bg-red-600 hover:bg-red-500 text-white px-5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  Confirm Remove
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
