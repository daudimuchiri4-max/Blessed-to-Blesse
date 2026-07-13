import React, { useState, useEffect } from "react";
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { 
  LogIn, 
  UserPlus, 
  Users, 
  Sparkles, 
  ShieldCheck, 
  ArrowRight, 
  Coins, 
  TrendingUp, 
  Lock, 
  CheckCircle2, 
  ChevronDown, 
  Activity,
  Award,
  ChevronLeft,
  ChevronRight
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

  // FAQ accordion states
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Interactive growth estimator states
  const [calcMembers, setCalcMembers] = useState(15);
  const [calcMonthlyContribution, setCalcMonthlyContribution] = useState(2000);
  const [calcAnnualYield, setCalcAnnualYield] = useState(8); // 8%

  // Slide state
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      src: "/src/assets/images/blessed_to_bless_community_1783933647176.jpg",
      title: "Blessed to Bless Self Help Group",
      subtitle: "United in Fellowship & Mutual Support",
      description: "Our community of faith and collaboration brings families together to share resources, foster lifelong bonds, and uplift each other daily."
    },
    {
      src: "/src/assets/images/blessed_to_bless_savings_1783933661739.jpg",
      title: "Secure Pooled Savings",
      subtitle: "Financial Cooperation Made Simple",
      description: "By saving together weekly, our group amasses a significant, secure investment fund. Our transparent ledger ensures every single coin is accounted for."
    },
    {
      src: "/src/assets/images/blessed_to_bless_empower_1783933674106.jpg",
      title: "Uplifting Members' Dreams",
      subtitle: "Flexible Micro-Loans for Thriving Businesses",
      description: "Through mutual trust, members access fair credit to launch or scale their local enterprises, helping our local economy grow."
    }
  ];

  // Auto-play slides
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [slides.length]);

  const handleNextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const handlePrevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      onLoginSuccess();
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/unauthorized-domain") {
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
    try {
      if (isRegistering) {
        if (!name) {
          setError("Please provide your name.");
          setLoading(false);
          return;
        }
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onLoginSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Authentication failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInAnonymously(auth);
      onLoginSuccess();
    } catch (err: any) {
      console.warn("Guest sign-in failed, falling back to simulated session:", err);
      const simulatedUser = {
        uid: "simulated-guest-user",
        displayName: "Simulated Guest",
        email: "guest-cooperator@chama.org",
        photoURL: "https://api.dicebear.com/7.x/initials/svg?seed=Simulated%20Guest",
        isAnonymous: true,
      };
      onLoginSuccess(simulatedUser);
    } finally {
      setLoading(false);
    }
  };

  const calculateChamaTreasury = (years: number) => {
    const monthlyRate = (calcAnnualYield / 100) / 12;
    const months = years * 12;
    const monthlyTotalContribution = calcMembers * calcMonthlyContribution;
    
    if (monthlyRate === 0) {
      return monthlyTotalContribution * months;
    }
    
    const futureValue = monthlyTotalContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
    return Math.round(futureValue);
  };

  const faqData = [
    {
      q: "What is a Chama?",
      a: "A Chama is a traditional cooperative investment group or micro-savings club where friends, family, or colleagues pool funds to save collectively, invest in high-yield assets, and provide micro-loans to one another."
    },
    {
      q: "Can members see other members' contributions?",
      a: "No. To maintain complete privacy and secure individual confidentiality, regular members are restricted to viewing only their own transactions and contributions. However, they can always transparently view the collective total of group monies and investments."
    },
    {
      q: "Who manages approvals and roles?",
      a: "The group is managed by trusted officers. The Treasurer is responsible for approving or rejecting contribution logs, while the Chairperson and Admins oversee group configurations and member roles."
    },
    {
      q: "Is my session data persistent?",
      a: "Yes! All transactions, approvals, interest logs, and loan requests are synchronized in real-time with a secure Google Firestore Database, guaranteeing data durability and transparency."
    }
  ];

  return (
    <div className="min-h-screen bg-white text-slate-800 flex flex-col justify-between selection:bg-emerald-500 selection:text-white font-sans relative overflow-x-hidden">
      
      {/* Soft decorative background gradients for light theme */}
      <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:32px_32px] opacity-[0.03] pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-50 rounded-full blur-[120px] pointer-events-none opacity-40" />
      
      {/* Header / Brand Navigation */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600 shadow-sm">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
              Blessed to Bless <span className="text-[10px] bg-emerald-50 text-emerald-600 font-mono border border-emerald-100 px-2 py-0.5 rounded-md uppercase">SHG Ledger</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">Mutual Cooperation & Development</p>
          </div>
        </div>
        
        {/* Navigation Quick Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs text-slate-500 font-medium">
          <a href="#hero-section" className="hover:text-emerald-600 transition-colors">Our Group</a>
          <a href="#features" className="hover:text-emerald-600 transition-colors">Key Features</a>
          <a href="#estimator" className="hover:text-emerald-600 transition-colors">Growth Estimator</a>
          <a href="#privacy" className="hover:text-emerald-600 transition-colors">Privacy Model</a>
          <a href="#faq" className="hover:text-emerald-600 transition-colors">FAQ</a>
        </nav>

        <div className="text-[10px] text-slate-400 font-mono hidden sm:block">
          STATUS: <span className="text-emerald-600 font-bold">● ONLINE</span>
        </div>
      </header>

      {/* Main Website Content */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-20">
        
        {/* Section 1: Hero Slider & Auth Portal */}
        <div id="hero-section" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* Left Hero Slider Block */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
            
            {/* Redesigned interactive slider */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl overflow-hidden p-3 shadow-sm flex-1 flex flex-col justify-between min-h-[460px] relative">
              
              {/* Photo Display Frame */}
              <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shadow-inner group">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={currentSlide}
                    src={slides[currentSlide].src}
                    alt={slides[currentSlide].title}
                    referrerPolicy="no-referrer"
                    initial={{ opacity: 0, scale: 1.02 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className="w-full h-full object-cover"
                  />
                </AnimatePresence>

                {/* Overlaid Banner Title with custom backing */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/25 to-transparent flex flex-col justify-end p-4 sm:p-6 text-white">
                  <span className="text-[10px] font-mono tracking-widest text-emerald-300 uppercase font-semibold bg-emerald-950/40 px-2.5 py-0.5 rounded border border-emerald-500/20 self-start mb-2">
                    {slides[currentSlide].subtitle}
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black tracking-tight drop-shadow-sm mb-1.5">
                    {slides[currentSlide].title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed max-w-lg drop-shadow-sm line-clamp-2">
                    {slides[currentSlide].description}
                  </p>
                </div>

                {/* Left & Right arrow controls */}
                <button
                  onClick={handlePrevSlide}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 p-2 bg-slate-950/40 hover:bg-slate-950/70 rounded-full border border-white/15 text-white transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextSlide}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 bg-slate-950/40 hover:bg-slate-950/70 rounded-full border border-white/15 text-white transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Carousel Indicator Dots */}
                <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-slate-950/50 px-2.5 py-1 rounded-full border border-white/10">
                  {slides.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentSlide(idx)}
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                        currentSlide === idx ? "bg-emerald-400 w-3" : "bg-white/40 hover:bg-white"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Slider Bottom Captions and Details */}
              <div className="pt-4 px-2 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Blessed to Bless Group Active Focus</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {slides.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentSlide(idx)}
                      className={`p-2.5 text-left rounded-xl border transition-all text-xs cursor-pointer ${
                        currentSlide === idx 
                          ? "bg-white border-emerald-500 shadow-sm text-emerald-700" 
                          : "bg-transparent border-slate-200 text-slate-500 hover:bg-slate-100/50"
                      }`}
                    >
                      <p className="font-bold font-mono text-[9px] uppercase tracking-wider mb-0.5">Slide 0{idx + 1}</p>
                      <p className="font-semibold truncate">{s.title.split(" ")[0] + " " + (s.title.split(" ")[1] || "")}</p>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* Right Login Portal Card */}
          <div className="lg:col-span-5 flex">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              id="auth-card"
              className="bg-slate-50 border border-slate-100 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col justify-between w-full relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl pointer-events-none opacity-50" />
              
              <div className="space-y-5">
                <div className="space-y-1">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">LEDGER PORTAL</span>
                  <h3 className="text-lg font-bold text-slate-900 mt-1.5">Sign In & Coordinate</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Access Blessed to Bless joint statistics, log your contributions, and apply for micro-credit.
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
                  className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-700 transition-all cursor-pointer text-xs shadow-sm"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.245-3.125C18.29 1.48 15.445 0 12.24 0 5.58 0 0 5.37 0 12s5.58 12 12.24 12c6.96 0 11.57-4.89 11.57-11.79 0-.795-.085-1.4-.195-1.925H12.24z"
                    />
                  </svg>
                  Connect with Google Account
                </button>

                <div className="relative flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <span className="relative px-2 bg-slate-50 text-[10px] font-mono text-slate-400 uppercase">
                    or custom login
                  </span>
                </div>

                {/* Accordion style Classic Email registration/login */}
                <details className="group border border-slate-200 rounded-xl overflow-hidden [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex items-center justify-between p-3 bg-white hover:bg-slate-50/50 cursor-pointer text-xs text-slate-600 select-none font-semibold">
                    <span className="flex items-center gap-2">
                      <LogIn className="w-3.5 h-3.5 text-slate-400" /> Standard Email Access
                    </span>
                    <ChevronDown className="w-3 h-3 transition duration-300 group-open:-rotate-180 text-slate-400" />
                  </summary>
                  
                  <form onSubmit={handleEmailAuth} className="p-4 bg-white border-t border-slate-100 space-y-4">
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
                      className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
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
                </details>

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
              </div>
            </motion.div>
          </div>
        </div>

        {/* Section 2: Core Platform Features */}
        <div id="features" className="space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">CAPABILITIES</span>
            <h3 className="text-2xl font-bold tracking-tight text-slate-900 mt-2">Blessed to Bless Group Capabilities</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              We leverage an advanced, secure double-entry digital ledger built specifically to ensure collective financial health and absolute integrity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Box 1 */}
            <div id="feat-ledger" className="p-6 bg-slate-50 border border-slate-100 rounded-2xl space-y-3 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <Coins className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900">Verified Deposits</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Log and track savings contributions. Features an audit-logged treasurer verification workflow to make sure records match genuine bank receipt deposits.
              </p>
            </div>

            {/* Box 2 */}
            <div id="feat-loans" className="p-6 bg-slate-50 border border-slate-100 rounded-2xl space-y-3 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <Activity className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900">Fair Mutual Credit</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Apply for community-guaranteed loans directly from the pooled funds. Dynamic interest calculation with formal approval flows prevents any group bias.
              </p>
            </div>

            {/* Box 3 */}
            <div id="feat-portfolio" className="p-6 bg-slate-50 border border-slate-100 rounded-2xl space-y-3 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900">Shared Wealth Growth</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Coordinate group asset investments such as collective lands, agricultural ventures, or high-yield savings accounts. View live distributions.
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: Interactive Mutual Chama Growth Estimator */}
        <div id="estimator" className="p-6 sm:p-8 bg-slate-50 border border-slate-100 rounded-2xl space-y-6 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Left side: Calculator parameters */}
            <div className="lg:col-span-5 space-y-5">
              <div className="space-y-2">
                <span className="text-[9px] font-mono text-emerald-600 uppercase tracking-widest bg-emerald-100/50 px-2.5 py-1 rounded-md border border-emerald-100">
                  Dynamic Projection
                </span>
                <h3 className="text-xl font-bold text-slate-900">Interactive Growth Estimator</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Adjust sliders to witness how consistent pooled savings compounds our collective wealth over time.
                </p>
              </div>

              {/* Slider 1: Member count */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono text-slate-600">
                  <span>Active Members</span>
                  <span className="text-emerald-700 font-bold">{calcMembers} cooperators</span>
                </div>
                <input 
                  type="range" 
                  min="5" 
                  max="100" 
                  value={calcMembers}
                  onChange={(e) => setCalcMembers(Number(e.target.value))}
                  className="w-full accent-emerald-600 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Slider 2: Monthly contribution */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono text-slate-600">
                  <span>Monthly Contribution</span>
                  <span className="text-emerald-700 font-bold">{calcMonthlyContribution.toLocaleString()} KES</span>
                </div>
                <input 
                  type="range" 
                  min="500" 
                  max="20000" 
                  step="500"
                  value={calcMonthlyContribution}
                  onChange={(e) => setCalcMonthlyContribution(Number(e.target.value))}
                  className="w-full accent-emerald-600 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Slider 3: Interest Yield */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-mono text-slate-600">
                  <span>Target Portfolio ROI</span>
                  <span className="text-emerald-700 font-bold">{calcAnnualYield}% APY</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="25" 
                  step="1"
                  value={calcAnnualYield}
                  onChange={(e) => setCalcAnnualYield(Number(e.target.value))}
                  className="w-full accent-emerald-600 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Right side: Dynamic results */}
            <div className="lg:col-span-7 bg-white p-6 rounded-xl border border-slate-200 space-y-6 shadow-sm">
              <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest text-center font-bold">Projected Blessed to Bless Net Asset Value</p>
              
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                  <p className="text-[9px] font-mono text-slate-400 uppercase">Year 1</p>
                  <p className="text-base font-bold font-mono text-slate-900">
                    {calculateChamaTreasury(1).toLocaleString()} <span className="text-[9px] text-slate-400">KES</span>
                  </p>
                </div>
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl space-y-1 relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-emerald-600 text-[7px] font-bold text-white px-1.5 py-0.5 font-mono uppercase rounded-bl shadow-sm">POPULAR</div>
                  <p className="text-[9px] font-mono text-slate-500 uppercase">Year 3</p>
                  <p className="text-base font-black font-mono text-emerald-700">
                    {calculateChamaTreasury(3).toLocaleString()} <span className="text-[9px] text-emerald-500">KES</span>
                  </p>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                  <p className="text-[9px] font-mono text-slate-400 uppercase">Year 5</p>
                  <p className="text-base font-bold font-mono text-slate-900">
                    {calculateChamaTreasury(5).toLocaleString()} <span className="text-[9px] text-slate-400">KES</span>
                  </p>
                </div>
              </div>

              {/* Informative advice based on parameters */}
              <div className="p-3.5 bg-emerald-50/40 border border-emerald-100/60 rounded-xl flex items-start gap-3 text-xs text-slate-600 leading-relaxed">
                <Award className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <p>
                  By contributing a collective <strong className="text-slate-800">{(calcMembers * calcMonthlyContribution).toLocaleString()} KES</strong> monthly as a {calcMembers}-member pool, reinvesting into a <strong className="text-slate-800">{calcAnnualYield}% APY</strong> agricultural or capital portfolio yields a total of <strong className="text-emerald-700">{calculateChamaTreasury(5).toLocaleString()} KES</strong> within 5 years!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Privacy & Permissions Framework */}
        <div id="privacy" className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-md text-xs font-mono font-bold">
              <Lock className="w-3.5 h-3.5" /> Strictly Confidential
            </span>
            <h3 className="text-2xl font-extrabold tracking-tight text-slate-900">Strict Permission Boundaries</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              We strictly enforce compartmentalized data boundaries to honor individual financial discretion and prevent group politics. 
              Each member's personal ledger remains private to them and designated auditors.
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-slate-800">Regular Members</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Can log new contributions, request loans, view their own personal history statements, and inspect total group statistics or available investments. They are strictly blocked from seeing specific logs of other members.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-slate-800">Treasurers</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Hold auditing clearance. Responsible for verifying other members' logged deposits against bank records to approve or reject them, ensuring 100% correct ledger accuracy.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-slate-800">Chairpersons & Admins</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Approve micro-loans, assign specific leadership roles (Treasurer, Secretary), add/remove members, and update core group settings.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Graphical Representation of Permissions */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4 shadow-sm">
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold">Data Privacy Mapping</p>
            
            <div className="space-y-3">
              {/* Box 1 */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="font-semibold text-slate-700">View Own Contribution Stats</span>
                </div>
                <span className="text-[9px] font-mono font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100">ALL MEMBERS</span>
              </div>

              {/* Box 2 */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="font-semibold text-slate-700">View Total Group Savings & Investments</span>
                </div>
                <span className="text-[9px] font-mono font-bold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded border border-emerald-100">ALL MEMBERS</span>
              </div>

              {/* Box 3 */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="font-semibold text-slate-700">View Other Members' Individual Logs</span>
                </div>
                <span className="text-[9px] font-mono font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100">TREASURER ONLY</span>
              </div>

              {/* Box 4 */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="font-semibold text-slate-700">Approve Contributions & Deposits</span>
                </div>
                <span className="text-[9px] font-mono font-bold bg-amber-50 text-amber-600 px-2 py-0.5 rounded border border-amber-100">TREASURER ONLY</span>
              </div>

              {/* Box 5 */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  <span className="font-semibold text-slate-700">Approve Loans & Assign Member Roles</span>
                </div>
                <span className="text-[9px] font-mono font-bold bg-purple-50 text-purple-600 px-2 py-0.5 rounded border border-purple-100">CHAIRPERSON ONLY</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 5: Interactive FAQ Accordion */}
        <div id="faq" className="space-y-6 max-w-3xl mx-auto">
          <div className="text-center space-y-2">
            <h3 className="text-xl font-bold tracking-tight text-slate-900 font-sans">Frequently Asked Questions</h3>
            <p className="text-xs text-slate-400">Click a question below to learn more about the Chama system.</p>
          </div>

          <div className="space-y-3">
            {faqData.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div 
                  key={index} 
                  id={`faq-item-${index}`}
                  className="bg-slate-50 border border-slate-100 rounded-xl overflow-hidden shadow-sm"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="w-full text-left p-4 flex items-center justify-between gap-4 font-semibold text-xs text-slate-700 hover:text-slate-900 transition-colors cursor-pointer select-none"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180 text-emerald-600" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 text-xs text-slate-500 leading-relaxed border-t border-slate-200/50 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </main>

      {/* Modern Public Footer */}
      <footer className="relative z-10 w-full border-t border-slate-100 bg-slate-50/80 backdrop-blur-sm">
        <div className="max-w-7xl w-full mx-auto px-6 py-5 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-400">
          <div>
            © 2026 BLESSED TO BLESS SELF HELP GROUP • ALL RIGHTS RESERVED
          </div>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> SECURE FIRESTORE SYNC</span>
            <span>COMMUNITY ACCELERATOR HUB</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
