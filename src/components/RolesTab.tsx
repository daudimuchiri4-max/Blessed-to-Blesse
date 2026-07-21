import React, { useState, useEffect } from "react";
import { collection, onSnapshot, doc, updateDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { Chama, Member, MemberPermissions } from "../types";
import { 
  Users, 
  Shield, 
  CheckCircle2, 
  Lock, 
  Edit, 
  X, 
  Settings, 
  Coins, 
  UserCheck, 
  Phone,
  Landmark,
  Image
} from "lucide-react";

export const getDefaultPermissions = (role: Member["role"]): MemberPermissions => {
  switch (role) {
    case "super_admin":
      return {
        approveLoans: true,
        recordContributions: true,
        manageMembers: true,
        scheduleMeetings: true,
        manageInvestments: true,
      };
    case "chairperson":
      return {
        approveLoans: true,
        recordContributions: true,
        manageMembers: true,
        scheduleMeetings: true,
        manageInvestments: true,
      };
    case "vice_chairperson":
      return {
        approveLoans: true,
        recordContributions: true,
        manageMembers: true,
        scheduleMeetings: true,
        manageInvestments: true,
      };
    case "secretary":
      return {
        approveLoans: false,
        recordContributions: false,
        manageMembers: true,
        scheduleMeetings: true,
        manageInvestments: false,
      };
    case "treasurer":
      return {
        approveLoans: true,
        recordContributions: true,
        manageMembers: false,
        scheduleMeetings: false,
        manageInvestments: true,
      };
    case "member":
    default:
      return {
        approveLoans: false,
        recordContributions: false,
        manageMembers: false,
        scheduleMeetings: false,
        manageInvestments: false,
      };
  }
};

interface RolesTabProps {
  chama: Chama;
  currentUserId: string;
  memberRole: Member["role"] | null;
}

export default function RolesTab({ chama, currentUserId, memberRole }: RolesTabProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Chama unit price & name state
  const [showUnitEdit, setShowUnitEdit] = useState(false);
  const [newSharePrice, setNewSharePrice] = useState("");
  const [showChamaEdit, setShowChamaEdit] = useState(false);
  const [chamaName, setChamaName] = useState("");
  const [chamaDesc, setChamaDesc] = useState("");
  const [showLogoEdit, setShowLogoEdit] = useState(false);
  const [logoInput, setLogoInput] = useState("");
  const [savingChama, setSavingChama] = useState(false);

  // Configure member permissions modal state
  const [configuringMember, setConfiguringMember] = useState<Member | null>(null);
  const [memberPhone, setMemberPhone] = useState("");
  const [selectedRole, setSelectedRole] = useState<Member["role"]>("member");
  const [permissions, setPermissions] = useState<MemberPermissions>({
    approveLoans: false,
    recordContributions: false,
    manageMembers: false,
    scheduleMeetings: false,
    manageInvestments: false,
  });
  const [savingPermission, setSavingPermission] = useState(false);

  const isLeader = memberRole === "super_admin" || memberRole === "chairperson" || chama.createdBy === currentUserId;

  // Real-time subscribe to members
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
        // Sort chairperson, vice_chairperson, treasurer, secretary, member
        const roleOrder = { chairperson: 0, secretary: 1, vice_chairperson: 2, treasurer: 3, member: 4 };
        list.sort((a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9));
        setMembers(list);
        setLoading(false);
      },
      (err) => {
        console.error("Error loading members:", err);
        setError("Failed to load members list.");
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [chama.id]);

  const handleOpenConfigure = (m: Member) => {
    setConfiguringMember(m);
    setMemberPhone(m.phoneNumber || "");
    setSelectedRole(m.role);
    setPermissions(m.permissions || getDefaultPermissions(m.role));
  };

  const handleRoleChangeInModal = (newRole: Member["role"]) => {
    setSelectedRole(newRole);
    // Auto-populate default permissions for convenience
    setPermissions(getDefaultPermissions(newRole));
  };

  const handleSaveConfiguration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configuringMember) return;

    setSavingPermission(true);
    try {
      await updateDoc(doc(db, "chamas", chama.id, "members", configuringMember.id), {
        role: selectedRole,
        phoneNumber: memberPhone.trim(),
        permissions: permissions,
      });
      setConfiguringMember(null);
    } catch (err: any) {
      console.error("Error saving member configurations:", err);
      alert("Error saving: " + err.message);
    } finally {
      setSavingPermission(false);
    }
  };

  const handleSaveSharePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(newSharePrice);
    if (isNaN(price) || price <= 0) {
      alert("Please enter a valid positive number.");
      return;
    }

    setSavingChama(true);
    try {
      await updateDoc(doc(db, "chamas", chama.id), {
        sharePrice: price,
      });
      setShowUnitEdit(false);
    } catch (err: any) {
      console.error("Error saving share price:", err);
      alert("Error: " + err.message);
    } finally {
      setSavingChama(false);
    }
  };

  const handleSaveChamaMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chamaName.trim()) return;

    setSavingChama(true);
    try {
      await updateDoc(doc(db, "chamas", chama.id), {
        name: chamaName.trim(),
        description: chamaDesc.trim(),
      });
      setShowChamaEdit(false);
    } catch (err: any) {
      console.error("Error saving chama settings:", err);
      alert("Error: " + err.message);
    } finally {
      setSavingChama(false);
    }
  };

  const handleSaveLogo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingChama(true);
    try {
      await updateDoc(doc(db, "chamas", chama.id), {
        logoURL: logoInput.trim() || null,
      });
      setShowLogoEdit(false);
    } catch (err: any) {
      console.error("Error saving logo:", err);
      alert("Error: " + err.message);
    } finally {
      setSavingChama(false);
    }
  };

  const getRoleDisplayName = (role: Member["role"]) => {
    switch (role) {
      case "super_admin": return "Super Admin";
      case "chairperson": return "Chairperson";
      case "secretary": return "Secretary";
      case "vice_chairperson": return "Vice Chairperson";
      case "treasurer": return "Treasurer";
      case "member": return "Regular Member";
      default: return role;
    }
  };

  const getRoleBadgeStyle = (role: Member["role"]) => {
    switch (role) {
      case "super_admin":
        return "bg-rose-500/10 text-rose-400 border border-rose-500/20";
      case "chairperson":
        return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      case "vice_chairperson":
        return "bg-teal-500/10 text-teal-400 border border-teal-500/20";
      case "secretary":
        return "bg-purple-500/10 text-purple-400 border border-purple-500/20";
      case "treasurer":
        return "bg-blue-500/10 text-blue-400 border border-blue-500/20";
      case "member":
      default:
        return "bg-slate-900 text-slate-400 border border-slate-800";
    }
  };

  return (
    <div className="space-y-6">

      {/* Top Config Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: Chama Title & Name */}
        <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">Chama Title & Name</h4>
              <p className="text-[10px] text-slate-500">Customize your investment group title.</p>
            </div>
          </div>
          <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-3 flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 shrink-0">
                <Landmark className="w-4 h-4" />
              </div>
              <span className="font-bold text-white text-xs truncate">{chama.name}</span>
            </div>
            {isLeader && (
              <button
                onClick={() => {
                  setChamaName(chama.name);
                  setChamaDesc(chama.description || "");
                  setShowChamaEdit(true);
                }}
                className="text-[11px] font-semibold px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg flex items-center gap-1 cursor-pointer transition-colors shrink-0"
              >
                <Edit className="w-3 h-3" /> Edit
              </button>
            )}
          </div>
        </div>

        {/* Card 2: Share Unit Price */}
        <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 shrink-0">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">Share Unit Price</h4>
              <p className="text-[10px] text-slate-500">Monetary value of 1 share unit.</p>
            </div>
          </div>
          <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-3 flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="font-bold text-emerald-400 text-xs font-mono">1 Unit = {chama.currency} {(chama.sharePrice || 2000).toLocaleString()}</span>
            </div>
            {isLeader && (
              <button
                onClick={() => {
                  setNewSharePrice((chama.sharePrice || 2000).toString());
                  setShowUnitEdit(true);
                }}
                className="text-[11px] font-semibold px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg flex items-center gap-1 cursor-pointer transition-colors shrink-0"
              >
                <Edit className="w-3 h-3" /> Edit
              </button>
            )}
          </div>
        </div>

        {/* Card 3: Chama Logo / Icon */}
        <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">Chama Logo / Icon</h4>
              <p className="text-[10px] text-slate-500">Select icon preset or enter image URL / emoji.</p>
            </div>
          </div>
          <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-3 flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              {chama.logoURL ? (
                chama.logoURL.startsWith("http") || chama.logoURL.startsWith("data:") ? (
                  <img 
                    src={chama.logoURL} 
                    alt="Logo" 
                    className="w-6 h-6 rounded-md object-cover border border-slate-800 shrink-0"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-md bg-slate-900 flex items-center justify-center text-[10px] font-bold text-indigo-400 border border-slate-800 shrink-0">
                    {chama.logoURL.substring(0, 2)}
                  </div>
                )
              ) : (
                <div className="w-6 h-6 rounded-md bg-slate-900 flex items-center justify-center text-[10px] font-bold text-indigo-400 border border-slate-800 shrink-0">
                  U
                </div>
              )}
              <span className="text-slate-300 text-xs truncate max-w-[100px] font-mono">
                {chama.logoURL ? (chama.logoURL.startsWith("http") ? "custom_url" : (chama.logoURL.startsWith("data:") ? "custom_image" : chama.logoURL)) : "users"}
              </span>
            </div>
            {isLeader && (
              <button
                onClick={() => {
                  setLogoInput(chama.logoURL || "");
                  setShowLogoEdit(true);
                }}
                className="text-[11px] font-semibold px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg flex items-center gap-1 cursor-pointer transition-colors shrink-0"
              >
                <Edit className="w-3 h-3" /> Edit Logo
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Member Roles & Permission Matrix Table */}
      <div className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-900 pb-4 flex-wrap gap-2">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" /> Member Roles & Permission Matrix
            </h3>
            <p className="text-xs text-slate-500 mt-1">Configure role levels, custom mobile contacts, and explicit system permissions.</p>
          </div>
          <span className="text-[10px] text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-850 font-mono">
            {isLeader ? "Click 'Configure Role' to manage users" : "View-only permission index"}
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-mono mt-3">SYNCHRONIZING PERMISSION LEDGER...</p>
          </div>
        ) : error ? (
          <div className="py-6 text-center text-xs text-red-400 font-mono">{error}</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-900 scrollbar-thin">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-900 font-mono text-[10px] uppercase tracking-wider">
                  <th className="py-3 px-4 min-w-[200px]">Member</th>
                  <th className="py-3 px-4">Assigned Role</th>
                  <th className="py-3 px-4 text-center">Approve Loans</th>
                  <th className="py-3 px-4 text-center">Record Contributions</th>
                  <th className="py-3 px-4 text-center">Manage Members</th>
                  <th className="py-3 px-4 text-center">Schedule Meetings</th>
                  <th className="py-3 px-4 text-center">Manage Investments</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/50">
                {members.map((m) => {
                  const mPerms = m.permissions || getDefaultPermissions(m.role);
                  return (
                    <tr key={m.id} className="hover:bg-slate-900/10 transition-colors">
                      {/* Member Info Column */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={m.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(m.name)}`}
                            alt={m.name}
                            className="w-8 h-8 rounded-full border border-slate-850 object-cover shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="font-bold text-slate-200 truncate">{m.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono truncate flex items-center gap-1.5">
                              {m.phoneNumber ? (
                                <>
                                  <Phone className="w-2.5 h-2.5 inline text-slate-600" />
                                  <span>{m.phoneNumber}</span>
                                </>
                              ) : (
                                <span>{m.email}</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Role Level Badges */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className={`inline-block text-[9px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${getRoleBadgeStyle(m.role)}`}>
                          {getRoleDisplayName(m.role)}
                        </span>
                      </td>

                      {/* Approve Loans Perm */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex justify-center">
                          {mPerms.approveLoans ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <Lock className="w-4 h-4 text-slate-800" />
                          )}
                        </div>
                      </td>

                      {/* Record Contributions Perm */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex justify-center">
                          {mPerms.recordContributions ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <Lock className="w-4 h-4 text-slate-800" />
                          )}
                        </div>
                      </td>

                      {/* Manage Members Perm */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex justify-center">
                          {mPerms.manageMembers ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <Lock className="w-4 h-4 text-slate-800" />
                          )}
                        </div>
                      </td>

                      {/* Schedule Meetings Perm */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex justify-center">
                          {mPerms.scheduleMeetings ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <Lock className="w-4 h-4 text-slate-800" />
                          )}
                        </div>
                      </td>

                      {/* Manage Investments Perm */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex justify-center">
                          {mPerms.manageInvestments ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <Lock className="w-4 h-4 text-slate-800" />
                          )}
                        </div>
                      </td>

                      {/* Action Button */}
                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        {isLeader ? (
                          <button
                            onClick={() => handleOpenConfigure(m)}
                            className="text-[10px] font-bold text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-500 border border-emerald-500/20 hover:border-emerald-500 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                          >
                            Configure Role
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-600 font-mono italic">No Access</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: Configure Role & Permissions */}
      {configuringMember && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Settings className="w-4.5 h-4.5 text-emerald-400" /> Configure Role & Access
              </h3>
              <button 
                onClick={() => setConfiguringMember(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-900">
              <img
                src={configuringMember.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(configuringMember.name)}`}
                alt={configuringMember.name}
                className="w-10 h-10 rounded-full border border-slate-800"
              />
              <div className="min-w-0">
                <p className="font-bold text-slate-200 text-sm truncate">{configuringMember.name}</p>
                <p className="text-[10px] text-slate-500 font-mono truncate">{configuringMember.email}</p>
              </div>
            </div>

            <form onSubmit={handleSaveConfiguration} className="space-y-4">
              {/* Phone Input */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-mono block">Mobile/Phone Number</label>
                <input
                  type="text"
                  value={memberPhone}
                  onChange={(e) => setMemberPhone(e.target.value)}
                  placeholder="e.g. +254 712 345 678"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/60 font-mono"
                />
              </div>

              {/* Role Select Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-mono block">Assigned Role Category</label>
                <select
                  value={selectedRole}
                  onChange={(e) => handleRoleChangeInModal(e.target.value as Member["role"])}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/60 font-mono"
                >
                  <option value="super_admin">Super Admin</option>
                  <option value="chairperson">Chairperson</option>
                  <option value="vice_chairperson">Vice Chairperson</option>
                  <option value="secretary">Secretary</option>
                  <option value="treasurer">Treasurer</option>
                  <option value="member">Regular Member</option>
                </select>
              </div>

              {/* Explicit Permissions Toggles */}
              <div className="space-y-2 pt-2">
                <label className="text-xs text-slate-400 font-mono block">Customize Permissions Matrix</label>
                
                <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-900 space-y-3">
                  {/* Approve Loans */}
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">Approve Loans</span>
                    <input
                      type="checkbox"
                      checked={permissions.approveLoans}
                      onChange={(e) => setPermissions({ ...permissions, approveLoans: e.target.checked })}
                      className="w-4.5 h-4.5 rounded text-emerald-500 bg-slate-900 border-slate-800 focus:ring-0 focus:ring-offset-0 accent-emerald-500 cursor-pointer"
                    />
                  </label>

                  {/* Record Contributions */}
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">Record Contributions</span>
                    <input
                      type="checkbox"
                      checked={permissions.recordContributions}
                      onChange={(e) => setPermissions({ ...permissions, recordContributions: e.target.checked })}
                      className="w-4.5 h-4.5 rounded text-emerald-500 bg-slate-900 border-slate-800 focus:ring-0 focus:ring-offset-0 accent-emerald-500 cursor-pointer"
                    />
                  </label>

                  {/* Manage Members */}
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">Manage Members</span>
                    <input
                      type="checkbox"
                      checked={permissions.manageMembers}
                      onChange={(e) => setPermissions({ ...permissions, manageMembers: e.target.checked })}
                      className="w-4.5 h-4.5 rounded text-emerald-500 bg-slate-900 border-slate-800 focus:ring-0 focus:ring-offset-0 accent-emerald-500 cursor-pointer"
                    />
                  </label>

                  {/* Schedule Meetings */}
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">Schedule Meetings</span>
                    <input
                      type="checkbox"
                      checked={permissions.scheduleMeetings}
                      onChange={(e) => setPermissions({ ...permissions, scheduleMeetings: e.target.checked })}
                      className="w-4.5 h-4.5 rounded text-emerald-500 bg-slate-900 border-slate-800 focus:ring-0 focus:ring-offset-0 accent-emerald-500 cursor-pointer"
                    />
                  </label>

                  {/* Manage Investments */}
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">Manage Investments</span>
                    <input
                      type="checkbox"
                      checked={permissions.manageInvestments}
                      onChange={(e) => setPermissions({ ...permissions, manageInvestments: e.target.checked })}
                      className="w-4.5 h-4.5 rounded text-emerald-500 bg-slate-900 border-slate-800 focus:ring-0 focus:ring-offset-0 accent-emerald-500 cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setConfiguringMember(null)}
                  className="flex-1 text-center font-semibold text-xs border border-slate-800 hover:border-slate-700 hover:bg-slate-900 text-slate-300 py-2.5 rounded-xl cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPermission}
                  className="flex-1 text-center font-semibold text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 py-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {savingPermission ? (
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Save Matrix"
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit 1 Unit Share Value */}
      {showUnitEdit && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xs w-full p-6 space-y-5 relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-mono uppercase font-bold text-white flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-400" /> Share Valuation Price
              </h3>
              <button 
                onClick={() => setShowUnitEdit(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSharePrice} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-mono block uppercase">Price Per Share ({chama.currency})</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={newSharePrice}
                  onChange={(e) => setNewSharePrice(e.target.value)}
                  placeholder="e.g. 2000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/60 font-mono"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUnitEdit(false)}
                  className="flex-1 text-center font-semibold text-xs border border-slate-800 hover:border-slate-700 py-2 rounded-xl text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingChama}
                  className="flex-1 text-center font-semibold text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 py-2 rounded-xl flex items-center justify-center gap-1.5"
                >
                  {savingChama ? "Saving..." : "Save Valuation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Chama Name & Description */}
      {showChamaEdit && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Settings className="w-4.5 h-4.5 text-emerald-400" /> Edit Chama Information
              </h3>
              <button 
                onClick={() => setShowChamaEdit(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveChamaMeta} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-mono block">Chama Name</label>
                <input
                  type="text"
                  required
                  value={chamaName}
                  onChange={(e) => setChamaName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/60"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-mono block">Description</label>
                <textarea
                  value={chamaDesc}
                  onChange={(e) => setChamaDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/60"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChamaEdit(false)}
                  className="flex-1 text-center font-semibold text-xs border border-slate-800 hover:border-slate-700 py-2.5 rounded-xl text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingChama}
                  className="flex-1 text-center font-semibold text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 py-2.5 rounded-xl flex items-center justify-center gap-1.5"
                >
                  {savingChama ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Chama Logo / Icon */}
      {showLogoEdit && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Image className="w-4.5 h-4.5 text-emerald-400" /> Edit Chama Logo / Icon
              </h3>
              <button 
                onClick={() => setShowLogoEdit(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLogo} className="space-y-4">
              {/* Preset Icons Selection */}
              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-mono block">Choose Icon Preset</label>
                <div className="grid grid-cols-4 gap-2.5">
                  {[
                    { name: "users", icon: Users, label: "Users" },
                    { name: "landmark", icon: Landmark, label: "Landmark" },
                    { name: "coins", icon: Coins, label: "Coins" },
                    { name: "shield", icon: Shield, label: "Shield" },
                  ].map((preset) => {
                    const IconComp = preset.icon;
                    const isSelected = logoInput === preset.name;
                    return (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => setLogoInput(preset.name)}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-xs font-semibold ${
                          isSelected 
                            ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" 
                            : "bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white"
                        }`}
                      >
                        <IconComp className="w-5 h-5" />
                        <span className="text-[10px]">{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Direct Input (Image URL or Emoji) */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-mono block">Image URL or Custom Emoji</label>
                <input
                  type="text"
                  value={logoInput}
                  onChange={(e) => setLogoInput(e.target.value)}
                  placeholder="e.g. 🌟 or https://example.com/logo.png"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/60"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Type a text/emoji, use a web image link, or upload an image file below.
                </p>
              </div>

              {/* Upload image option */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-mono block">Or Upload Brand Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setLogoInput(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      } catch (err) {
                        console.error(err);
                      }
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-400 file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-slate-900 file:text-emerald-400 hover:file:bg-slate-850 cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLogoEdit(false)}
                  className="flex-1 text-center font-semibold text-xs border border-slate-800 hover:border-slate-700 py-2.5 rounded-xl text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingChama}
                  className="flex-1 text-center font-semibold text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 py-2.5 rounded-xl flex items-center justify-center gap-1.5"
                >
                  {savingChama ? "Saving..." : "Save Logo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
