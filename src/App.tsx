import React, { useState, useEffect, useRef } from "react";
import { onAuthStateChanged, signOut, User, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, onSnapshot, collection, query, where, getDocs, deleteDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";
import { Chama, Member, ChamaNotification } from "./types";
import { createChamaNotification } from "./utils/notifications";
import DashboardTab from "./components/DashboardTab";
import ContributionsTab from "./components/ContributionsTab";
import InvestmentsTab from "./components/InvestmentsTab";
import LoansTab from "./components/LoansTab";
import MembersTab from "./components/MembersTab";
import RolesTab from "./components/RolesTab";
import LandingPage from "./components/LandingPage";
import { 
  Users, 
  Landmark, 
  LogOut, 
  ShieldAlert, 
  Shield,
  Sparkles, 
  User as UserIcon, 
  Settings, 
  Upload, 
  Trash2, 
  X,
  Share2,
  QrCode,
  Copy,
  Check,
  Bell,
  BellOff
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Compresses and resizes an uploaded image using an HTML5 canvas to keep Firestore document size small.
const compressImage = (file: File, maxWidth: number, maxHeight: number, quality: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(event.target?.result as string); // fallback
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL("image/jpeg", quality);
        resolve(compressedBase64);
      };
      img.onerror = (err) => {
        reject(err);
      };
    };
    reader.onerror = (err) => {
      reject(err);
    };
  });
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedChama, setSelectedChama] = useState<Chama | null>(null);
  const [memberRecord, setMemberRecord] = useState<Member | null>(null);
  const [activeTab, setActiveTab] = useState<"dashboard" | "contributions" | "investments" | "loans" | "members" | "roles">("dashboard");

  // Notifications State
  const [notifications, setNotifications] = useState<ChamaNotification[]>([]);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const notificationsDropdownRef = useRef<HTMLDivElement>(null);

  // Modal states
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Group settings inputs
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [groupContrib, setGroupContrib] = useState(1000);
  const [groupFreq, setGroupFreq] = useState<"weekly" | "monthly" | "custom">("weekly");
  const [groupLogoBase64, setGroupLogoBase64] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Profile settings inputs
  const [profileName, setProfileName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // File input Ref for cross-platform reliability on mobile devices
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  // Auth subscriber
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setAuthLoading(false);
        // Log user details in /users/{userId} to adhere to schema
        const userRef = doc(db, "users", currentUser.uid);
        const name = currentUser.displayName || currentUser.email?.split("@")[0] || "Cooperator";
        await setDoc(
          userRef,
          {
            id: currentUser.uid,
            name,
            email: currentUser.email || `${currentUser.uid.substring(0, 6)}@anonymous.chama`,
            photoURL: currentUser.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
            createdAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } else {
        setUser(null);
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load and select the single Chama automatically
  useEffect(() => {
    if (!user) {
      setSelectedChama(null);
      return;
    }

    // Subscribe to all chamas to find or create the single group
    const unsubscribeChamas = onSnapshot(collection(db, "chamas"), async (snapshot) => {
      if (snapshot.empty) {
        const defaultChamaId = "single-chama";
        const defaultChama: Omit<Chama, "id"> = {
          name: "Main Cooperative Chama",
          description: "Our joint group savings pool and mutual credit association.",
          totalSavings: 0,
          totalInvestments: 0,
          totalLoans: 0,
          frequency: "weekly",
          contributionAmount: 1000,
          currency: "KES",
          createdBy: user.uid,
          createdAt: new Date().toISOString(),
        };
        try {
          await setDoc(doc(db, "chamas", defaultChamaId), defaultChama);
        } catch (err) {
          console.error("Error creating default chama:", err);
        }
      } else {
        // Automatically select the first available chama
        const firstChamaDoc = snapshot.docs[0];
        const chamaData = { id: firstChamaDoc.id, ...firstChamaDoc.data() } as Chama;
        setSelectedChama(chamaData);
      }
    });

    return () => unsubscribeChamas();
  }, [user]);

  // Sync group settings form inputs when selectedChama loads or updates live
  useEffect(() => {
    if (selectedChama) {
      setGroupName(selectedChama.name);
      setGroupDesc(selectedChama.description);
      setGroupContrib(selectedChama.contributionAmount);
      setGroupFreq(selectedChama.frequency);
      setGroupLogoBase64(selectedChama.logoURL || null);
    }
  }, [selectedChama?.id]);

  // Dynamic favicon updater based on selected Chama's logo
  useEffect(() => {
    let faviconUrl = "";
    if (selectedChama && selectedChama.logoURL) {
      faviconUrl = selectedChama.logoURL;
    } else {
      // Default SVG favicon
      faviconUrl = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>👥</text></svg>`;
    }

    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    link.href = faviconUrl;
  }, [selectedChama?.logoURL]);

  // Sync profile settings name input when memberRecord loads or updates
  useEffect(() => {
    if (memberRecord) {
      setProfileName(memberRecord.name);
    } else if (user) {
      setProfileName(user.displayName || user.email?.split("@")[0] || "Cooperator");
    }
  }, [memberRecord, user]);

  // Real-time subscribe to the user's membership record inside the selected Chama to fetch role details
  useEffect(() => {
    if (!selectedChama || !user) {
      setMemberRecord(null);
      return;
    }

    const memberDocRef = doc(db, "chamas", selectedChama.id, "members", user.uid);

    const unsubscribeMember = onSnapshot(
      memberDocRef,
      async (docSnap) => {
        if (docSnap.exists()) {
          setMemberRecord(docSnap.data() as Member);
        } else {
          // Auto-join the user as a member if they aren't registered yet!
          // Check if they were pre-added by email manually
          try {
            const membersColl = collection(db, "chamas", selectedChama.id, "members");
            const q = query(membersColl, where("email", "==", user.email || ""));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
              // Found a manual member record! Let's migrate it to user.uid
              const firstMatch = querySnapshot.docs[0];
              const manualData = firstMatch.data();
              
              const updatedMemberData = {
                ...manualData,
                id: user.uid,
                userId: user.uid,
                isPending: false, // successfully registered & authenticated!
                photoURL: manualData.photoURL || user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(manualData.name || "Cooperator")}`,
              };
              
              // 1. Create the doc with user.uid as ID
              await setDoc(memberDocRef, updatedMemberData);
              
              // 2. Delete the old manual doc if its ID wasn't already user.uid
              if (firstMatch.id !== user.uid) {
                await deleteDoc(doc(db, "chamas", selectedChama.id, "members", firstMatch.id));
              }
            } else {
              // Create a brand new auto-joined member record
              const name = user.displayName || user.email?.split("@")[0] || "Cooperator";
              const isCreator = selectedChama.createdBy === user.uid;
              
              // Determine role: Chairperson for the group creator, or if first member. Otherwise Member.
              const membersSnap = await getDocs(collection(db, "chamas", selectedChama.id, "members"));
              const role = isCreator || membersSnap.empty ? "chairperson" : "member";

              const memberData: Member = {
                id: user.uid,
                userId: user.uid,
                name,
                email: user.email || `${user.uid.substring(0, 6)}@anonymous.chama`,
                photoURL: user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
                role: role,
                joinedAt: new Date().toISOString(),
              };
              await setDoc(memberDocRef, memberData);
            }
          } catch (err) {
            console.error("Error auto-joining user:", err);
            setMemberRecord(null);
          }
        }
      },
      (error) => {
        console.error("Error reading membership:", error);
        setMemberRecord(null);
      }
    );

    return () => unsubscribeMember();
  }, [selectedChama?.id, user?.uid, user?.email]);

  // Real-time subscribe to notifications in selected Chama
  useEffect(() => {
    if (!selectedChama || !user) {
      setNotifications([]);
      return;
    }

    const notificationsColl = collection(db, "chamas", selectedChama.id, "notifications");
    const unsubscribeNotifications = onSnapshot(
      notificationsColl,
      (snapshot) => {
        const list: ChamaNotification[] = [];
        snapshot.forEach((docSnap) => {
          const notif = { id: docSnap.id, ...docSnap.data() } as ChamaNotification;
          // Filter: either broadcast (no userId) OR targeted specifically to this user
          if (!notif.userId || notif.userId === user.uid) {
            // If the user has NOT marked it as read (userId not in readBy array)
            if (!notif.readBy || !notif.readBy.includes(user.uid)) {
              list.push(notif);
            }
          }
        });
        // Sort by createdAt descending
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setNotifications(list);
      },
      (error) => {
        console.error("Error reading notifications:", error);
      }
    );

    return () => unsubscribeNotifications();
  }, [selectedChama?.id, user?.uid]);

  // Handle clicking outside the notification dropdown to close it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (showNotificationsDropdown && notificationsDropdownRef.current) {
        if (!notificationsDropdownRef.current.contains(event.target as Node)) {
          const bellBtn = document.getElementById("notifications-bell");
          if (!bellBtn || !bellBtn.contains(event.target as Node)) {
            setShowNotificationsDropdown(false);
          }
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showNotificationsDropdown]);

  const handleDismissNotification = async (notif: ChamaNotification) => {
    if (!selectedChama || !user) return;
    try {
      const notifRef = doc(db, "chamas", selectedChama.id, "notifications", notif.id);
      if (!notif.userId) {
        // Broadcast notification - mark as read for this user
        await updateDoc(notifRef, {
          readBy: arrayUnion(user.uid),
        });
      } else {
        // Targeted notification - delete completely from Firestore
        await deleteDoc(notifRef);
      }
    } catch (err) {
      console.error("Error dismissing/deleting notification:", err);
      // Construct compliance error structure
      const errInfo = {
        error: err instanceof Error ? err.message : String(err),
        operationType: notif.userId ? "delete" : "update",
        path: `chamas/${selectedChama.id}/notifications/${notif.id}`,
        authInfo: {
          userId: user.uid,
          email: user.email,
        }
      };
      console.error("Firestore Error info:", JSON.stringify(errInfo));
    }
  };

  // Background check for pending payments past the 10th of the month
  useEffect(() => {
    if (!selectedChama || !user) return;

    const runBackgroundCheck = async () => {
      const today = new Date();
      if (today.getDate() < 10) return; // Only past/on the 10th of the month

      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;
      const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;

      try {
        // Fetch all members
        const membersSnap = await getDocs(collection(db, "chamas", selectedChama.id, "members"));
        const membersList: Member[] = [];
        membersSnap.forEach((docSnap) => {
          membersList.push({ id: docSnap.id, ...docSnap.data() } as Member);
        });

        // Fetch all contributions
        const contributionsSnap = await getDocs(collection(db, "chamas", selectedChama.id, "contributions"));
        const contributionsList: any[] = [];
        contributionsSnap.forEach((docSnap) => {
          contributionsList.push({ id: docSnap.id, ...docSnap.data() });
        });

        for (const m of membersList) {
          if (m.isPending) continue; // Skip pending invitations

          // Check if this member has an approved contribution of type "savings" this month
          const hasSavingsThisMonth = contributionsList.some((c) => {
            if (!c.date) return false;
            if (c.userId !== m.userId && c.userId !== m.id) return false;
            if (c.type !== "savings") return false;
            if (c.status !== "approved") return false;

            const cDate = new Date(c.date);
            if (isNaN(cDate.getTime())) return false;
            const cMonthStr = `${cDate.getFullYear()}-${String(cDate.getMonth() + 1).padStart(2, "0")}`;
            return cMonthStr === currentMonthStr;
          });

          if (!hasSavingsThisMonth) {
            // Check if we already sent a 'Payment Pending' notification to this user this month
            const alreadyNotified = m.lastNotifiedMonth === currentMonthStr;

            if (!alreadyNotified) {
              const monthName = today.toLocaleDateString("en-US", { month: "long" });
              await createChamaNotification(selectedChama.id, {
                title: "Payment Pending",
                message: `Hi ${m.name}, your monthly savings contribution of ${selectedChama.contributionAmount.toLocaleString()} ${selectedChama.currency} for ${monthName} was due on the 10th. Please complete your payment.`,
                type: "warning",
                userId: m.userId || m.id,
                link: "contributions",
              });

              // Persist the last notified month on the member's document
              const memberDocRef = doc(db, "chamas", selectedChama.id, "members", m.id);
              await updateDoc(memberDocRef, {
                lastNotifiedMonth: currentMonthStr,
              });
            }
          }
        }
      } catch (err) {
        console.error("Error running auto-payment background check:", err);
      }
    };

    runBackgroundCheck();
  }, [selectedChama?.id, user?.uid]);

  const handleLogout = async () => {
    setUser(null);
    setSelectedChama(null);
    await signOut(auth);
  };

  const handleSaveGroupSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChama) return;
    setSavingSettings(true);
    try {
      await setDoc(doc(db, "chamas", selectedChama.id), {
        name: groupName.trim(),
        description: groupDesc.trim(),
        contributionAmount: Number(groupContrib),
        frequency: groupFreq,
        logoURL: groupLogoBase64 || null,
      }, { merge: true });
      setShowGroupSettings(false);
    } catch (err: any) {
      console.error("Error updating group settings:", err);
      alert("Error saving settings. The image file may be too large or there was a connection issue. Error: " + (err.message || err));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        // Compress image to 180x180 JPEG at 0.8 quality to keep size tiny (~10KB-15KB) and fit Firestore 1MB document limit
        const compressedBase64 = await compressImage(file, 180, 180, 0.8);
        setGroupLogoBase64(compressedBase64);
      } catch (err) {
        console.error("Image compression failed, falling back to original:", err);
        if (file.size > 500 * 1024) {
          alert("Image is too large and compression failed. Please upload a smaller image (under 500KB).");
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          setGroupLogoBase64(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSaveProfileSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profileName.trim()) return;
    setSavingProfile(true);
    try {
      // Update member record
      if (selectedChama) {
        const memberRef = doc(db, "chamas", selectedChama.id, "members", user.uid);
        await setDoc(memberRef, {
          name: profileName.trim(),
          photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(profileName.trim())}`
        }, { merge: true });
      }

      // Update public user profile
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        name: profileName.trim(),
        photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(profileName.trim())}`
      }, { merge: true });

      setShowProfileSettings(false);
    } catch (err) {
      console.error("Error saving profile settings:", err);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLinkGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setShowProfileSettings(false);
    } catch (err) {
      console.error("Error linking Google account:", err);
    }
  };

  // Render Loader or Landing Page
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center font-sans">
        <div className="space-y-4 text-center">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-mono tracking-widest uppercase">AUDITING SECURITY SYSTEMS & SYNCING LEDGERS...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage onLoginSuccess={() => {}} />;
  }

  if (!selectedChama) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center font-sans">
        <div className="space-y-4 text-center">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-mono tracking-widest uppercase">CREATING OR SYNCING CHAMA GROUP...</p>
        </div>
      </div>
    );
  }

  const effectiveDisplayName = memberRecord?.name || user?.displayName || user?.email?.split("@")[0] || "Guest Cooperator";
  const currentRole = memberRecord?.role || "member";
  const isLeader = currentRole === "super_admin" || currentRole === "chairperson" || currentRole === "vice_chairperson" || currentRole === "treasurer" || currentRole === "secretary" || selectedChama.createdBy === user?.uid;
  const isAdmin = currentRole === "super_admin" || currentRole === "chairperson" || selectedChama.createdBy === user?.uid;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.02] pointer-events-none" />

      {/* Workspace Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between border-b border-slate-900 gap-4">
        
        {/* Left Side: Logo & Group Name with Edit Option */}
        <div className="flex items-center gap-4 self-start md:self-auto min-w-0">
          {selectedChama.logoURL ? (
            <img 
              src={selectedChama.logoURL} 
              alt="Logo" 
              className="w-11 h-11 rounded-xl object-cover shrink-0 border border-slate-800 bg-slate-900" 
            />
          ) : (
            <div className="p-2.5 bg-emerald-950/50 border border-emerald-500/30 rounded-xl text-emerald-400 shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
          )}
          
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight truncate">
                {selectedChama.name}
              </h2>
              {isAdmin && (
                <button
                  onClick={() => setShowGroupSettings(true)}
                  className="p-1 hover:bg-slate-900 border border-transparent hover:border-slate-800 rounded text-slate-500 hover:text-white transition-colors cursor-pointer"
                  title="Configure group & logo"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-500 truncate max-w-xs md:max-w-md">{selectedChama.description}</p>
          </div>
        </div>

        {/* Right Side: Account info with Edit Profile Option */}
        <div className="flex items-center gap-4 justify-between w-full md:w-auto self-end md:self-auto border-t border-slate-900/60 pt-3 md:pt-0 md:border-t-0">
          
          {/* Role badge */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
              {currentRole}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowProfileSettings(true)}
              className="flex items-center gap-2 text-right hover:opacity-80 transition-opacity cursor-pointer group"
              title="Edit personal profile"
            >
              <div className="text-right">
                <span className="text-xs font-semibold text-slate-300 block max-w-[120px] truncate group-hover:text-emerald-400 transition-colors">
                  {effectiveDisplayName}
                </span>
                <span className="text-[9px] font-mono text-slate-500 block">Edit Profile</span>
              </div>
              <img
                src={memberRecord?.photoURL || user?.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(effectiveDisplayName)}`}
                alt="Profile"
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full border border-slate-800 group-hover:border-emerald-500 transition-colors"
              />
            </button>

            {/* Notification Bell with Dropdown */}
            <div className="relative">
              <button
                id="notifications-bell"
                onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
                className="p-2 bg-slate-900 border border-slate-800 rounded-xl hover:border-emerald-500/40 hover:text-emerald-400 text-slate-400 hover:bg-slate-950 transition-all cursor-pointer flex items-center justify-center relative"
                title="View notifications"
              >
                <Bell className="w-4 h-4" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white font-mono text-[9px] font-extrabold w-4.5 h-4.5 rounded-full flex items-center justify-center animate-pulse">
                    {notifications.length}
                  </span>
                )}
              </button>

              {/* Notification Dropdown List */}
              <AnimatePresence>
                {showNotificationsDropdown && (
                  <motion.div
                    ref={notificationsDropdownRef}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl z-50 overflow-hidden py-1"
                  >
                    <div className="px-4 py-3 border-b border-slate-800/80 flex items-center justify-between">
                      <span className="text-xs font-bold font-sans text-slate-200 tracking-wider uppercase">Notifications</span>
                      {notifications.length > 0 && (
                        <button
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            try {
                              const promises = notifications.map((notif) => handleDismissNotification(notif));
                              await Promise.all(promises);
                            } catch (err) {
                              console.error("Failed to dismiss all notifications:", err);
                            }
                          }}
                          className="text-[9px] font-mono text-emerald-400 hover:text-emerald-300 uppercase tracking-wider font-extrabold cursor-pointer"
                        >
                          Dismiss All
                        </button>
                      )}
                    </div>

                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/40 scrollbar-none">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-xs text-slate-500 space-y-2">
                          <BellOff className="w-6 h-6 mx-auto text-slate-700" />
                          <p className="font-mono text-[9px] tracking-wider uppercase">All Caught Up</p>
                          <p>No new alerts from your cooperative.</p>
                        </div>
                      ) : (
                        notifications.map((notif) => {
                          return (
                            <div 
                              key={notif.id} 
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (notif.link) {
                                  setActiveTab(notif.link as any);
                                }
                                await handleDismissNotification(notif);
                                setShowNotificationsDropdown(false);
                              }}
                              className="p-3 hover:bg-slate-950/60 transition-colors flex gap-2.5 items-start text-xs group cursor-pointer"
                              title={notif.link ? `Go to ${notif.link}` : "Dismiss notification"}
                            >
                              <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                                notif.type === "alert" ? "bg-red-500 animate-pulse" :
                                notif.type === "warning" ? "bg-amber-500" :
                                notif.type === "success" ? "bg-emerald-500" : "bg-blue-500"
                              }`} />
                              <div className="flex-1 space-y-1">
                                <div className="flex items-start justify-between gap-1">
                                  <span className="font-semibold text-slate-200 block truncate max-w-[170px]">{notif.title}</span>
                                  <span className="text-[8px] font-mono text-slate-500 shrink-0 mt-0.5">
                                    {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 leading-relaxed pr-2">{notif.message}</p>
                                <div className="flex items-center justify-between pt-1">
                                  {notif.link ? (
                                    <span className="text-[9px] font-mono text-emerald-400 group-hover:text-emerald-350 font-extrabold uppercase tracking-wider flex items-center gap-1">
                                      Go to Tab &rarr;
                                    </span>
                                  ) : (
                                    <div />
                                  )}
                                  <button
                                    onClick={async (e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      await handleDismissNotification(notif);
                                    }}
                                    className="text-[9px] font-mono text-slate-500 hover:text-slate-300 uppercase tracking-wider cursor-pointer font-bold opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    Dismiss
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={() => setShowShareModal(true)}
              className="p-2 bg-slate-900 border border-slate-800 rounded-xl hover:border-emerald-500/40 hover:text-emerald-400 text-slate-450 hover:bg-slate-950 transition-all cursor-pointer flex items-center gap-1.5"
              title="Share app with QR code"
            >
              <Share2 className="w-4 h-4" />
              <span className="text-[10px] font-bold font-sans hidden sm:inline uppercase tracking-wider">Share App</span>
            </button>

            <button
              onClick={handleLogout}
              className="p-2 bg-slate-900 border border-slate-800 rounded-xl hover:border-red-950/40 hover:text-red-400 text-slate-450 hover:bg-slate-950 transition-all cursor-pointer"
              title="Logout session"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col gap-6">

        {/* Tab Selection Navigation Bar */}
        <div className="border-b border-slate-900/60 flex items-center gap-1 overflow-x-auto pb-px scrollbar-none">
          {[
            { id: "dashboard", label: "Dashboard", icon: Landmark },
            { id: "members", label: "Members", icon: Users },
            { id: "contributions", label: "Contributions", icon: Users },
            { id: "investments", label: "Investments", icon: Sparkles },
            { id: "loans", label: "Credit Loans", icon: Landmark },
            { id: "roles", label: "Roles & Access", icon: Shield },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-semibold cursor-pointer transition-all whitespace-nowrap ${
                  isSelected
                    ? "border-emerald-500 text-emerald-400 bg-emerald-500/[0.02]"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Icon className={`w-4 h-4 ${isSelected ? "text-emerald-400" : "text-slate-500"}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Active Workspace View Panel */}
        <div className="flex-1 py-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === "dashboard" && (
                <DashboardTab chama={selectedChama} currentUserId={user.uid} />
              )}
              {activeTab === "contributions" && (
                <ContributionsTab
                  chama={selectedChama}
                  currentUserId={user.uid}
                  memberRole={currentRole}
                  currentUserDisplayName={effectiveDisplayName}
                />
              )}
              {activeTab === "investments" && (
                <InvestmentsTab
                  chama={selectedChama}
                  currentUserId={user.uid}
                  memberRole={currentRole}
                />
              )}
              {activeTab === "loans" && (
                <LoansTab
                  chama={selectedChama}
                  currentUserId={user.uid}
                  memberRole={currentRole}
                  currentUserDisplayName={effectiveDisplayName}
                />
              )}
              {activeTab === "members" && (
                <MembersTab
                  chama={selectedChama}
                  currentUserId={user.uid}
                  memberRole={currentRole}
                />
              )}
              {activeTab === "roles" && (
                <RolesTab
                  chama={selectedChama}
                  currentUserId={user.uid}
                  memberRole={currentRole}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

      </main>

      {/* Group Settings Modal (Rename & Logo Upload) */}
      <AnimatePresence>
        {showGroupSettings && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 relative"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-emerald-400" /> Group Configuration
                </h3>
                <button 
                  onClick={() => setShowGroupSettings(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveGroupSettings} className="space-y-4">
                {/* Logo Upload Section */}
                <div className="space-y-2">
                  <label className="text-xs text-slate-400 font-mono block">Group Brand Logo</label>
                  <div className="flex items-center gap-4">
                    <div className="relative group shrink-0">
                      {groupLogoBase64 ? (
                        <img 
                          src={groupLogoBase64} 
                          alt="Preview" 
                          className="w-16 h-16 rounded-xl object-cover border border-slate-700 bg-slate-950" 
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl border border-dashed border-slate-700 bg-slate-950 flex items-center justify-center text-slate-500">
                          <Landmark className="w-6 h-6" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => logoFileInputRef.current?.click()}
                          className="bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5"
                        >
                          <Upload className="w-3.5 h-3.5" /> Upload Image
                        </button>
                        <input 
                          type="file" 
                          ref={logoFileInputRef}
                          accept="image/*" 
                          onChange={handleLogoUpload} 
                          className="hidden" 
                        />
                        {groupLogoBase64 && (
                          <button
                            type="button"
                            onClick={() => setGroupLogoBase64(null)}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-950/20 rounded-lg border border-transparent hover:border-red-900/30 cursor-pointer transition-colors"
                            title="Remove logo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500">Supports PNG, JPG, or SVG up to 2MB. Logo updates instantly for all group members.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-mono">Chama Name</label>
                  <input
                    type="text"
                    required
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. Dynamic Synergy Chama"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-mono">Chama Description</label>
                  <textarea
                    rows={2}
                    value={groupDesc}
                    onChange={(e) => setGroupDesc(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 resize-none"
                    placeholder="Short summary of goals, investment vision, or compliance guidelines."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-mono">Target Contribution ({selectedChama.currency})</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={groupContrib}
                      onChange={(e) => setGroupContrib(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-mono">Frequency</label>
                    <select
                      value={groupFreq}
                      onChange={(e) => setGroupFreq(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowGroupSettings(false)}
                    className="px-4 py-2 text-xs font-mono text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                  >
                    {savingSettings ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* User Profile Modal (Change Name & Link Google) */}
      <AnimatePresence>
        {showProfileSettings && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 relative"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-emerald-400" /> My Profile Settings
                </h3>
                <button 
                  onClick={() => setShowProfileSettings(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProfileSettings} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-mono">My Display Name</label>
                  <input
                    type="text"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    placeholder="Enter your name"
                  />
                  <p className="text-[10px] text-slate-500">Your custom avatar will update automatically based on your initials.</p>
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowProfileSettings(false)}
                    className="px-4 py-2 text-xs font-mono text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                  >
                    {savingProfile ? "Saving..." : "Save Profile"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Share App Modal (QR Code & Quick Copy Link) */}
      <AnimatePresence>
        {showShareModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-5 relative shadow-xl text-slate-800"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-[#1D4ED8] flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-emerald-600" /> Share Cooperative App
                </h3>
                <button 
                  onClick={() => setShowShareModal(false)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-center">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Invite members and leaders to join <strong className="text-slate-800">{selectedChama.name}</strong>. Scan the QR code below or copy the portal URL to send it directly!
                </p>

                {/* QR Code Container */}
                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-100 max-w-[280px] mx-auto">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.origin)}`}
                    alt="App QR Code"
                    className="w-[180px] h-[180px] rounded-lg shadow-sm border border-slate-200 bg-white p-2"
                  />
                  <span className="text-[9px] font-mono font-bold text-slate-400 uppercase mt-2.5 flex items-center gap-1.5">
                    <QrCode className="w-3 h-3 text-slate-400" /> scan with mobile camera
                  </span>
                </div>

                {/* URL Copy Container */}
                <div className="space-y-1.5 text-left">
                  <label className="text-xs text-slate-500 font-mono">Cooperative Access Link</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={window.location.origin}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none select-all font-mono"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.origin);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="px-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Native share option if supported */}
                {typeof navigator !== "undefined" && navigator.share && (
                  <button
                    onClick={() => {
                      navigator.share({
                        title: selectedChama.name,
                        text: `Join ${selectedChama.name} on the Blessed to Bless Cooperative Applet!`,
                        url: window.location.origin,
                      }).catch(console.error);
                    }}
                    className="w-full py-2.5 bg-[#059669] hover:bg-[#10B981] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
                  >
                    <Share2 className="w-4 h-4" /> Share to other Apps
                  </button>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowShareModal(false)}
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dynamic Status Bar Footer */}
      <footer className="w-full border-t border-slate-900 bg-slate-950/80 backdrop-blur-sm relative z-10">
        <div className="max-w-7xl w-full mx-auto px-6 py-3 flex items-center justify-between gap-4 text-[10px] font-mono text-slate-500">
          <div className="flex items-center gap-3">
            {selectedChama.logoURL ? (
              <img 
                src={selectedChama.logoURL} 
                alt="Logo" 
                className="w-4 h-4 rounded object-cover border border-slate-800 bg-slate-900" 
              />
            ) : (
              <Landmark className="w-4 h-4 text-emerald-500" />
            )}
            <span>{selectedChama.name} Portal</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden md:inline">Copyright ©DaveTech Solutions 2026 | All Rights Reserved</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
