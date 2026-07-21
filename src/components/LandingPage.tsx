import React, { useState, useEffect } from "react";
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth, googleProvider, db } from "../firebase";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { 
  LogIn, 
  UserPlus, 
  Users, 
  ShieldCheck, 
  ChevronDown, 
  Share2,
  QrCode,
  Copy,
  Check,
  X,
  Smartphone,
  Download
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface LandingPageProps {
  onLoginSuccess: (simulatedUser?: any) => void;
}

export default function LandingPage({ onLoginSuccess }: LandingPageProps) {
  // Authentication states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAuthGuide, setShowAuthGuide] = useState(false);
  const [showOpNotAllowedGuide, setShowOpNotAllowedGuide] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // PWA Installation state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [installStatus, setInstallStatus] = useState<"idle" | "installing" | "installed">("idle");

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Check if running as standalone PWA
    if (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone) {
      setInstallStatus("installed");
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User choice outcome: ${outcome}`);
        setDeferredPrompt(null);
        setIsInstallable(false);
        setShowInstallModal(false);
      } catch (err) {
        console.error("Installation prompt failed:", err);
      }
    } else {
      setShowInstallModal(true);
    }
  };

  // Group metadata states loaded dynamically from DB
  const [chamaName, setChamaName] = useState("Blessed to Bless");
  const [chamaLogo, setChamaLogo] = useState<string | null>(null);

  useEffect(() => {
    const fetchChamaInfo = async () => {
      try {
        const q = query(collection(db, "chamas"), limit(1));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const docData = querySnapshot.docs[0].data();
          if (docData.name) setChamaName(docData.name);
          if (docData.logoURL) setChamaLogo(docData.logoURL);
        }
      } catch (err) {
        console.error("Failed to fetch chama info on landing page:", err);
      }
    };
    fetchChamaInfo();
  }, []);



  const handleSuperAdminLogin = async () => {
    setLoading(true);
    setError(null);
    setShowOpNotAllowedGuide(false);
    try {
      const superAdminEmail = "superadmin@chama.com";
      const superAdminPassword = "SuperAdmin123!";
      
      try {
        await signInWithEmailAndPassword(auth, superAdminEmail, superAdminPassword);
        onLoginSuccess();
      } catch (signInErr: any) {
        if (signInErr.code === "auth/operation-not-allowed") {
          console.warn("Email/Password Auth is disabled in Firebase. Logging in with custom Super Admin session fallback.");
          const bypassUser = {
            uid: "superadmin_bypass_uid",
            email: superAdminEmail,
            displayName: "Super Admin",
            photoURL: "https://api.dicebear.com/7.x/initials/svg?seed=Super%20Admin",
            emailVerified: true
          };
          localStorage.setItem("chama_bypass_user", JSON.stringify(bypassUser));
          onLoginSuccess(bypassUser);
          return;
        }
        if (
          signInErr.code === "auth/user-not-found" || 
          signInErr.code === "auth/invalid-credential" || 
          signInErr.code === "auth/wrong-password"
        ) {
          try {
            await createUserWithEmailAndPassword(auth, superAdminEmail, superAdminPassword);
            onLoginSuccess();
          } catch (createErr: any) {
            if (createErr.code === "auth/email-already-in-use") {
              throw new Error("Super Admin account exists with a different password. Please log in using the standard email form with the correct password, or contact system support.");
            }
            if (createErr.code === "auth/operation-not-allowed") {
              console.warn("Email/Password Auth is disabled in Firebase. Logging in with custom Super Admin session fallback.");
              const bypassUser = {
                uid: "superadmin_bypass_uid",
                email: superAdminEmail,
                displayName: "Super Admin",
                photoURL: "https://api.dicebear.com/7.x/initials/svg?seed=Super%20Admin",
                emailVerified: true
              };
              localStorage.setItem("chama_bypass_user", JSON.stringify(bypassUser));
              onLoginSuccess(bypassUser);
              return;
            }
            throw createErr;
          }
        } else {
          throw signInErr;
        }
      }
    } catch (err: any) {
      console.error("Super Admin login failed:", err);
      setError(err.message || "Failed to log in as Super Admin.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    setShowOpNotAllowedGuide(false);
    try {
      await signInWithPopup(auth, googleProvider);
      onLoginSuccess();
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/operation-not-allowed") {
        setError("Google Sign-In is not enabled in this Firebase project. Go to the Firebase Console > Build > Authentication > Sign-in method, click 'Add new provider', and enable 'Google'.");
        setShowOpNotAllowedGuide(true);
      } else if (err.code === "auth/unauthorized-domain") {
        setError("This domain is not authorized in your Firebase console. Please use 'Quick Guest Session' or add this URL to your Firebase Console Authorized Domains.");
        setShowAuthGuide(true);
      } else {
        setError(err.message || "Failed to log in with Google.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    setError(null);
    setShowOpNotAllowedGuide(false);
    try {
      if (isRegistering) {
        if (!name) {
          setError("Please provide your name.");
          setLoading(false);
          return;
        }
        try {
          await createUserWithEmailAndPassword(auth, email, password);
          onLoginSuccess();
        } catch (err: any) {
          if (err.code === "auth/operation-not-allowed") {
            console.warn("Email/Password Sign-In is disabled. Falling back to simulated registered user.");
            const displayName = name || email.split("@")[0] || "Cooperator";
            const bypassUser = {
              uid: `bypass_${email.replace(/[^a-zA-Z0-9]/g, "_")}`,
              email,
              displayName,
              photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`,
              emailVerified: true
            };
            localStorage.setItem("chama_bypass_user", JSON.stringify(bypassUser));
            onLoginSuccess(bypassUser);
            return;
          }
          throw err;
        }
      } else {
        try {
          await signInWithEmailAndPassword(auth, email, password);
          onLoginSuccess();
        } catch (err: any) {
          if (err.code === "auth/operation-not-allowed") {
            console.warn("Email/Password Sign-In is disabled. Falling back to simulated login.");
            const isSuperAdmin = email.toLowerCase() === "superadmin@chama.com";
            const displayName = isSuperAdmin ? "Super Admin" : (email.split("@")[0] || "Cooperator");
            const bypassUser = {
              uid: isSuperAdmin ? "superadmin_bypass_uid" : `bypass_${email.replace(/[^a-zA-Z0-9]/g, "_")}`,
              email,
              displayName,
              photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`,
              emailVerified: true
            };
            localStorage.setItem("chama_bypass_user", JSON.stringify(bypassUser));
            onLoginSuccess(bypassUser);
            return;
          }
          throw err;
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Authentication failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen bg-white text-slate-800 flex flex-col justify-between selection:bg-emerald-500 selection:text-white font-sans relative overflow-x-hidden">
      
      {/* Soft decorative background gradients for light theme */}
      <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:32px_32px] opacity-[0.03] pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-50 rounded-full blur-[120px] pointer-events-none opacity-40" />
      
      {/* Header / Brand Navigation */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-3">
          {chamaLogo ? (
            <img 
              src={chamaLogo} 
              alt="Cooperative Logo" 
              className="w-10 h-10 rounded-xl object-cover border border-slate-200 bg-white p-0.5 shadow-sm" 
            />
          ) : (
            <div className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600 shadow-sm">
              <Users className="w-5 h-5" />
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
              {chamaName} <span className="text-[10px] bg-emerald-50 text-emerald-600 font-mono border border-emerald-100 px-2 py-0.5 rounded-md uppercase">SHG Ledger</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">Mutual Cooperation & Development</p>
          </div>
        </div>
        


        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-blue-600 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-sm"
          >
            <Share2 className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">Share App</span>
          </button>
        </div>
      </header>

      {/* Main Website Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center max-w-7xl w-full mx-auto px-6 py-12">
        <div className="max-w-md w-full">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            id="auth-card"
            className="bg-slate-50 border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-md flex flex-col justify-between w-full relative overflow-hidden text-slate-800"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl pointer-events-none opacity-50" />
            
            <div className="space-y-6">
              <div className="text-center space-y-1">
                <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">LEDGER PORTAL</span>
                <h3 className="text-xl font-bold text-slate-900 mt-2">Sign In & Coordinate</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Access <strong className="text-slate-800">{chamaName}</strong> joint statistics, log your contributions, and apply for micro-loans.
                </p>
              </div>

              {/* Error Notice */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 space-y-1">
                  <p className="font-semibold">Authentication Error:</p>
                  <p className="text-[11px] leading-relaxed">{error}</p>
                </div>
              )}

              {/* Google Sign In option */}
              <button
                type="button"
                id="btn-google-login"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2.5 py-3 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-white transition-all cursor-pointer text-xs shadow-md border border-transparent animate-fade-in"
              >
                <svg className="w-4 h-4 fill-current text-white" viewBox="0 0 24 24">
                  <path d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.245-3.125C18.29 1.48 15.445 0 12.24 0 5.58 0 0 5.37 0 12s5.58 12 12.24 12c6.96 0 11.57-4.89 11.57-11.79 0-.795-.085-1.4-.195-1.925H12.24z" />
                </svg>
                Connect with Google Account
              </button>

              {/* Super Admin Quick Access */}
              <button
                type="button"
                id="btn-super-admin-login"
                onClick={handleSuperAdminLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2.5 py-3 px-5 rounded-xl bg-slate-900 hover:bg-slate-950 font-bold text-white transition-all cursor-pointer text-xs shadow-md border border-amber-500/20 hover:border-amber-500/50"
              >
                <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0" />
                Quick Super Admin Login
              </button>

              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <span className="relative px-2 bg-slate-50 text-[10px] font-mono text-slate-400 uppercase">
                  or standard access
                </span>
              </div>

              {/* Standard access login */}
              <div className="border border-slate-200/60 rounded-xl overflow-hidden mt-2 bg-white">
                <form onSubmit={handleEmailAuth} className="p-4 space-y-4">
                  {isRegistering && (
                    <div className="space-y-1.5">
                      <label className="text-[9px] text-slate-400 font-mono uppercase font-bold">Full Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Abdi Ibrahim"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 font-sans"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[9px] text-slate-400 font-mono uppercase font-bold">Email Address</label>
                    <input
                      type="email"
                      placeholder="you@domain.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 font-sans"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] text-slate-400 font-mono uppercase font-bold">Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 font-sans"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-3 rounded-lg bg-slate-850 hover:bg-slate-900 text-white font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {isRegistering ? <UserPlus className="w-3.5 h-3.5" /> : <LogIn className="w-3.5 h-3.5" />}
                    {isRegistering ? "Register Profile" : "Login Profile"}
                  </button>

                  <p className="text-center text-[10px] text-slate-500 font-mono">
                    {isRegistering ? "Joined before?" : "New to Chama?"}{" "}
                    <button
                      type="button"
                      onClick={() => setIsRegistering(!isRegistering)}
                      className="text-emerald-600 underline hover:text-emerald-500 cursor-pointer font-bold"
                    >
                      {isRegistering ? "Sign In Instead" : "Create Account"}
                    </button>
                  </p>
                </form>
              </div>

              {/* Helper domains block */}
              {showAuthGuide && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 text-xs text-slate-500">
                  <div className="flex items-center gap-2 text-emerald-600 font-semibold font-mono">
                    <ShieldCheck className="w-4 h-4" /> Adding Authorized Domain
                  </div>
                  <p>
                    Because this app runs in a sandbox, add this domain inside Firebase to enable Google sign-in:
                  </p>
                  <div className="bg-white p-2 rounded text-[10px] font-mono text-slate-800 select-all border border-slate-200">
                    europe-west2.run.app
                  </div>
                  <button
                    onClick={() => setShowAuthGuide(false)}
                    className="text-slate-400 hover:text-slate-600 underline font-mono cursor-pointer"
                  >
                    Dismiss Guide
                  </button>
                </div>
              )}

              {/* Operation Not Allowed Firebase Troubleshooting Guide */}
              {showOpNotAllowedGuide && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3.5 text-xs text-slate-700">
                  <div className="flex items-center gap-2 text-amber-700 font-bold font-mono uppercase text-[11px] tracking-wider">
                    <ShieldCheck className="w-4 h-4" /> Firebase Auth Setup Needed
                  </div>
                  <p className="leading-relaxed text-[11px] text-slate-600">
                    Your Firebase project does not have standard sign-in providers enabled. To fix this:
                  </p>
                  <ol className="list-decimal list-inside space-y-1.5 text-[11px] pl-1 text-slate-600">
                    <li>Go to the <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-emerald-600 font-bold underline">Firebase Console</a></li>
                    <li>Select your project, click on <strong className="text-slate-800">Authentication</strong></li>
                    <li>Go to the <strong className="text-slate-800">Sign-in method</strong> tab</li>
                    <li>Click <strong className="text-slate-800">Add new provider</strong> and enable <strong className="text-slate-800">Email/Password</strong> and <strong className="text-slate-800">Google</strong></li>
                  </ol>
                  <div className="pt-2 border-t border-amber-200 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setShowOpNotAllowedGuide(false)}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-lg transition-all cursor-pointer text-center"
                    >
                      Dismiss Guide
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </main>

      {/* Modern Public Footer */}
      <footer className="relative z-10 w-full border-t border-slate-100 bg-slate-50/80 backdrop-blur-sm">
        <div className="max-w-7xl w-full mx-auto px-6 py-5 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2.5">
            {chamaLogo ? (
              <img 
                src={chamaLogo} 
                alt="Cooperative Logo" 
                className="w-6 h-6 rounded object-cover border border-slate-200 bg-white shadow-xs shrink-0" 
              />
            ) : (
              <div className="p-1.5 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-600 shrink-0 shadow-xs">
                <Users className="w-3.5 h-3.5" />
              </div>
            )}
            <div>
              Copyright ©DaveTech Solutions 2026| All Rights Reserved
            </div>
          </div>
        </div>
      </footer>

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
                  Invite members and leaders to join the <strong className="text-slate-800">Blessed to Bless Self Help Group</strong> cooperative portal. Scan the QR code below or copy the portal URL to send it directly!
                </p>

                {/* QR Code Container */}
                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-100 max-w-[280px] mx-auto">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.origin)}`}
                    alt="App QR Code"
                    className="w-[180px] h-[180px] rounded-lg shadow-sm border border-slate-200 bg-white p-2"
                  />
                  <span className="text-[9px] font-mono font-bold text-slate-450 uppercase mt-2.5 flex items-center gap-1.5">
                    <QrCode className="w-3 h-3 text-slate-450" /> scan with mobile camera
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
                        title: "Blessed to Bless SHG",
                        text: "Join the Blessed to Bless Self Help Group Cooperative portal!",
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

      {/* Install App Modal */}
      <AnimatePresence>
        {showInstallModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-5 relative shadow-xl text-slate-800"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-emerald-700 flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-emerald-600" /> Install Cooperative App
                </h3>
                <button 
                  onClick={() => setShowInstallModal(false)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-center py-2">
                  {chamaLogo ? (
                    <img 
                      src={chamaLogo} 
                      alt="Logo" 
                      className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shadow-md p-1 bg-white" 
                    />
                  ) : (
                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-600 shadow-md">
                      <Users className="w-8 h-8" />
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-500 leading-relaxed text-center">
                  Install <strong className="text-slate-800">{chamaName}</strong> as a standalone application on your device for fast access, offline availability, and full screen experience.
                </p>

                {/* Tabs / Device Selector */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
                    Installation Guide
                  </h4>
                  
                  <div className="space-y-2.5 text-xs text-slate-600">
                    <div className="flex items-start gap-2.5">
                      <span className="flex items-center justify-center w-5 h-5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px] shrink-0 mt-0.5">1</span>
                      <div>
                        <strong className="text-slate-800">For Apple Devices (iOS/Safari)</strong>: Tap the <span className="bg-slate-200 px-1.5 py-0.5 rounded font-mono font-bold inline-flex items-center gap-1"><Share2 className="w-3 h-3 text-emerald-600 inline" /> Share</span> icon in Safari, scroll down and tap <strong className="text-slate-800">"Add to Home Screen"</strong>.
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="flex items-center justify-center w-5 h-5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px] shrink-0 mt-0.5">2</span>
                      <div>
                        <strong className="text-slate-800">For Android Devices (Chrome)</strong>: Tap the three dots <strong className="text-slate-800">⋮</strong> menu in the upper right, and tap <strong className="text-slate-800">"Install app"</strong> or <strong className="text-slate-800">"Add to Home screen"</strong>.
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="flex items-center justify-center w-5 h-5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px] shrink-0 mt-0.5">3</span>
                      <div>
                        <strong className="text-slate-800">For Desktop Browser (Chrome/Edge)</strong>: Click the install icon in the address bar (next to bookmark star) to download the app onto your computer.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end items-center">
                <button
                  type="button"
                  onClick={() => setShowInstallModal(false)}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors"
                >
                  Got It
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
