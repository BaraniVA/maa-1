import { useState, useRef, useEffect } from "react";
import { Send, Heart, Info, User, Bot, Loader2, Globe, Mic, MicOff, Volume2, VolumeX, Trash2, ThumbsUp, ThumbsDown, Check, MessageSquare, Bell, Calendar, Clock, Plus, X, AlertCircle, ChevronLeft, ChevronRight, List, Pencil, Save, Home, Settings, Sparkles } from "lucide-react";
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";

// Initialize Gemini API
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const languages = {
  english: { label: "English", code: "en-US", welcome: "Hello! I'm your Maternal AI assistant. How can I support you today? Whether you have questions about pregnancy, postpartum care, or newborn health, I'm here to help." },
  tamil: { label: "தமிழ்", code: "ta-IN", welcome: "வணக்கம்! நான் உங்கள் தாய்வழி AI உதவியாளர். இன்று நான் உங்களுக்கு எப்படி உதவ முடியும்? கர்ப்பம், பிரசவத்திற்குப் பிந்தைய பராமரிப்பு அல்லது பிறந்த குழந்தையின் ஆரோக்கியம் குறித்து உங்களுக்கு கேள்விகள் இருந்தால், நான் உதவ இங்கே இருக்கிறேன்." },
  telugu: { label: "తెలుగు", code: "te-IN", welcome: "నమస్కారం! నేను మీ మాతృత్వ AI సహాయకుడిని. ఈరోజు నేను మీకు ఎలా సహాయపడగలను? గర్భధారణ, ప్రసవానంతర సంరక్షణ లేదా నవజాత శిశువు ఆరోగ్యం గురించి మీకు ఏవైనా ప్రశ్నలు ఉంటే, నేను సహాయం చేయడానికి ఇక్కడ ఉన్నాను." },
  marathi: { label: "मराठी", code: "mr-IN", welcome: "नमस्कार! मी तुमचा मातृत्त्व AI सहाय्यक आहे. मी आज तुम्हाला कशी मदत करू शकतो? तुम्हाला गर्भधारणा, प्रसूतीनंतरची काळजी किंवा नवजात बालकाच्या आरोग्याबद्दल काही प्रश्न असल्यास, मी मदत करण्यासाठी येथे आहे." },
  malayalam: { label: "മലയാളം", code: "ml-IN", welcome: "നമസ്കാരം! ഞാൻ നിങ്ങളുടെ മാതൃത്വ AI സഹായിയാണ്. ഇന്ന് എനിക്ക് നിങ്ങളെ എങ്ങനെ സഹായിക്കാനാകും? ഗർഭധാരണം, പ്രസവാനന്തര പരിചരണം അല്ലെങ്കിൽ നവജാതശിശുവിന്റെ ആരോഗ്യം എന്നിവയെക്കുറിച്ച് നിങ്ങൾക്ക് എന്തെങ്കിലും ചോദ്യങ്ങളുണ്ടെങ്കിൽ, സഹായിക്കാൻ ഞാൻ ഇവിടെയുണ്ട്." }
};

type LanguageKey = keyof typeof languages;

interface Message {
  role: "user" | "bot";
  text: string;
  feedback?: {
    rating?: "up" | "down";
    comment?: string;
  };
}

interface Appointment {
  id: string;
  title: string;
  date: string;
  time: string;
  notified?: boolean;
  notifiedTwoDaysBefore?: boolean;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

function App() {
  const [activeTab, setActiveTab] = useState<"home" | "chat" | "calendar" | "profile">("home");
  const [selectedLang, setSelectedLang] = useState<LanguageKey>(() => {
    const saved = localStorage.getItem("maternal_ai_lang");
    return (saved as LanguageKey) || "english";
  });
  const [mood, setMood] = useState<string | null>(() => localStorage.getItem("maternal_ai_mood"));
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem("maternal_ai_history");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved history", e);
      }
    }
    return [{ role: "bot", text: languages.english.welcome }];
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [feedbackIndex, setFeedbackIndex] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [showAppointments, setShowAppointments] = useState(false);
  const [apptView, setApptView] = useState<"list" | "calendar">("list");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    const saved = localStorage.getItem("maternal_ai_appointments");
    return saved ? JSON.parse(saved) : [];
  });
  const [newAppt, setNewAppt] = useState({ title: "", date: "", time: "" });
  const [activeNotification, setActiveNotification] = useState<(Appointment & { isTwoDayNotification?: boolean }) | null>(null);
  const [editingApptId, setEditingApptId] = useState<string | null>(null);
  const [editApptData, setEditApptData] = useState({ title: "", date: "", time: "" });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Save history to local storage
  useEffect(() => {
    localStorage.setItem("maternal_ai_history", JSON.stringify(messages));
  }, [messages]);

  // Save language to local storage
  useEffect(() => {
    localStorage.setItem("maternal_ai_lang", selectedLang);
  }, [selectedLang]);

  // Save appointments to local storage
  useEffect(() => {
    localStorage.setItem("maternal_ai_appointments", JSON.stringify(appointments));
  }, [appointments]);

  // Check for upcoming appointments every minute
  useEffect(() => {
    const checkAppointments = () => {
      const now = new Date();
      const updatedAppts = appointments.map(appt => {
        const apptDateTime = new Date(`${appt.date}T${appt.time}`);
        const diffInMinutes = (apptDateTime.getTime() - now.getTime()) / (1000 * 60);
        const twoDaysInMinutes = 2 * 24 * 60; // 2880 minutes
        
        // Notify if appointment is 2 days away and not yet notified
        if (diffInMinutes > twoDaysInMinutes - 1 && diffInMinutes <= twoDaysInMinutes && !appt.notifiedTwoDaysBefore) {
          setActiveNotification({ ...appt, isTwoDayNotification: true } as any);
          return { ...appt, notifiedTwoDaysBefore: true };
        }
        
        // Notify if appointment is within 30 minutes and not yet notified
        if (diffInMinutes > 0 && diffInMinutes <= 30 && !appt.notified) {
          setActiveNotification(appt);
          return { ...appt, notified: true };
        }
        return appt;
      });

      if (JSON.stringify(updatedAppts) !== JSON.stringify(appointments)) {
        setAppointments(updatedAppts);
      }
    };

    const interval = setInterval(checkAppointments, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [appointments]);

  // Save mood to local storage
  useEffect(() => {
    if (mood) localStorage.setItem("maternal_ai_mood", mood);
  }, [mood]);

  const suggestedQuestions = [
    { text: "What should I eat today?", icon: "🥗" },
    { text: "Is light exercise safe?", icon: "🧘‍♀️" },
    { text: "Tips for better sleep?", icon: "🌙" },
    { text: "Signs of early labor?", icon: "⚠️" },
  ];

  const moods = [
    { emoji: "😊", label: "Happy", color: "bg-amber-100 text-amber-600" },
    { emoji: "😌", label: "Calm", color: "bg-emerald-100 text-emerald-600" },
    { emoji: "😴", label: "Tired", color: "bg-indigo-100 text-indigo-600" },
    { emoji: "😰", label: "Anxious", color: "bg-rose-100 text-rose-600" },
    { emoji: "🤩", label: "Excited", color: "bg-pink-100 text-pink-600" },
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Update welcome message when language changes if it's the only message
  useEffect(() => {
    if (messages.length === 1 && messages[0].role === "bot") {
      setMessages([{ role: "bot", text: languages[selectedLang].welcome }]);
    }
  }, [selectedLang]);

  // Text-to-Speech function
  const speak = (text: string) => {
    if (isMuted) return;
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = languages[selectedLang].code;
    
    // Try to find a better voice for the language if available
    const voices = window.speechSynthesis.getVoices();
    const langVoice = voices.find(v => v.lang.startsWith(languages[selectedLang].code.split('-')[0]));
    if (langVoice) utterance.voice = langVoice;

    window.speechSynthesis.speak(utterance);
  };

  const clearHistory = () => {
    window.speechSynthesis.cancel();
    const defaultMsg: Message = { role: "bot", text: languages[selectedLang].welcome };
    setMessages([defaultMsg]);
    localStorage.removeItem("maternal_ai_history");
    setFeedbackIndex(null);
    setFeedbackText("");
  };

  const addAppointment = () => {
    if (!newAppt.title || !newAppt.date || !newAppt.time) return;
    const appt: Appointment = {
      id: Date.now().toString(),
      ...newAppt,
      notified: false,
      notifiedTwoDaysBefore: false
    };
    setAppointments(prev => [...prev, appt].sort((a, b) => 
      new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime()
    ));
    setNewAppt({ title: "", date: "", time: "" });
  };

  const removeAppointment = (id: string) => {
    setAppointments(prev => prev.filter(a => a.id !== id));
  };

  const startEditing = (appt: Appointment) => {
    setEditingApptId(appt.id);
    setEditApptData({ title: appt.title, date: appt.date, time: appt.time });
  };

  const saveEdit = () => {
    if (!editingApptId || !editApptData.title || !editApptData.date || !editApptData.time) return;
    setAppointments(prev => prev.map(a => 
      a.id === editingApptId ? { ...a, ...editApptData, notified: false, notifiedTwoDaysBefore: false } : a
    ).sort((a, b) => 
      new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime()
    ));
    setEditingApptId(null);
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  };

  const handleFeedback = (index: number, rating: "up" | "down") => {
    setMessages(prev => {
      const newMessages = [...prev];
      newMessages[index] = {
        ...newMessages[index],
        feedback: { ...newMessages[index].feedback, rating }
      };
      return newMessages;
    });
  };

  const submitTextFeedback = (index: number) => {
    if (!feedbackText.trim()) return;
    setMessages(prev => {
      const newMessages = [...prev];
      newMessages[index] = {
        ...newMessages[index],
        feedback: { ...newMessages[index].feedback, comment: feedbackText }
      };
      return newMessages;
    });
    setFeedbackIndex(null);
    setFeedbackText("");
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.error("Speech Recognition not supported in this browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = languages[selectedLang].code;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      window.speechSynthesis.cancel(); // Stop AI speaking if user starts talking
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMessage }]);
    setIsLoading(true);

    try {
      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          ...messages.map(m => ({
            role: (m.role === "user" ? "user" : "model") as "user" | "model",
            parts: [{ text: m.text }]
          })),
          { role: "user", parts: [{ text: userMessage }] }
        ],
        config: {
          systemInstruction: `You are a compassionate Maternal Health AI Assistant.
Always reply ONLY in ${languages[selectedLang].label} language.
Keep answers simple, safe, and accurate for pregnant women.

STRUCTURE:
- Use clear headings if the response is long.
- Use bullet points (*) for lists of symptoms, advice, or steps.
- Keep paragraphs short and easy to read.

FORMATTING: Use Markdown bolding (**text**) to highlight important medical terms, specific advice, or emergency warnings to make them stand out for the user.

If a user mentions severe symptoms (like heavy bleeding, severe pain, or mental health crisis), strongly advise them to contact their healthcare provider or emergency services immediately. Keep responses concise but informative.`
        }
      });

      const botText = response.text || "I'm sorry, I couldn't generate a response.";
      setMessages(prev => [...prev, { role: "bot", text: botText }]);
      speak(botText); // Speak the AI response
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      const errorMsg = "I'm sorry, I encountered an error. Please try again in a moment.";
      setMessages(prev => [...prev, { role: "bot", text: errorMsg }]);
      speak(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-pattern font-sans overflow-hidden">
      <div className="w-full max-w-md h-screen sm:h-[92vh] bg-white sm:rounded-[3.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] flex flex-col overflow-hidden border border-white/50 relative">
        <div className="noise-overlay"></div>
        
        {/* Header */}
        <div className="px-8 pt-10 pb-4 bg-white/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="rose-gradient p-2.5 rounded-2xl shadow-lg shadow-rose-200"
            >
              <Heart className="text-white fill-white" size={20} />
            </motion.div>
            <div>
              <h1 className="text-2xl font-serif italic font-semibold text-slate-900 tracking-tight leading-none">Maternal</h1>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.1em]">AI Assistant</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Language Selector */}
            <div className="relative group">
              <button className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 px-3.5 py-2 rounded-2xl transition-all text-[10px] font-bold text-slate-600 border border-slate-100">
                <Globe size={12} className="text-rose-400" />
                {languages[selectedLang].label}
              </button>
              <div className="absolute right-0 top-full mt-2 w-36 glass rounded-3xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all overflow-hidden text-slate-700 z-50 p-1">
                {(Object.keys(languages) as LanguageKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setSelectedLang(key)}
                    className={`w-full text-left px-4 py-3 text-[10px] font-bold rounded-2xl transition-all ${selectedLang === key ? "text-rose-500 bg-rose-50" : "hover:bg-slate-50"}`}
                  >
                    {languages[key].label}
                  </button>
                ))}
              </div>
            </div>
            
            <button 
              onClick={() => {
                setIsMuted(!isMuted);
                if (!isMuted) window.speechSynthesis.cancel();
              }}
              className={`p-2.5 rounded-2xl transition-all ${isMuted ? "text-slate-300 bg-slate-50" : "text-rose-500 bg-rose-50"}`}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
          <AnimatePresence mode="wait">
            {activeTab === "home" && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                className="flex-1 overflow-y-auto px-8 py-6 space-y-8 no-scrollbar"
              >
                {/* Hero Card */}
                <div className="rose-gradient rounded-[3rem] p-8 text-white shadow-2xl shadow-rose-200 relative overflow-hidden group">
                  <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
                  <div className="absolute -left-8 -bottom-8 w-48 h-48 bg-pink-400/20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
                  
                  <div className="relative z-10">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-100/80 mb-2 block">Welcome Back</span>
                    <h2 className="text-3xl font-serif italic font-medium mb-2 leading-tight">Hello, Mama!</h2>
                    <p className="text-rose-100/90 text-sm font-medium leading-relaxed max-w-[80%]">Your journey is beautiful. How can I help you today?</p>
                    
                    <div className="mt-8 flex gap-3">
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setActiveTab("chat")}
                        className="bg-white text-rose-500 px-6 py-3 rounded-2xl text-xs font-bold shadow-xl shadow-rose-900/10"
                      >
                        Start Chat
                      </motion.button>
                      <button className="bg-white/10 backdrop-blur-md text-white px-6 py-3 rounded-2xl text-xs font-bold border border-white/20 hover:bg-white/20 transition-all">
                        Daily Tips
                      </button>
                    </div>
                  </div>
                </div>

                {/* Mood Tracker */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">How are you feeling?</h3>
                    {mood && <span className="text-[10px] font-bold text-rose-500">Last: {mood}</span>}
                  </div>
                  <div className="flex justify-between gap-2">
                    {moods.map((m) => (
                      <motion.button
                        key={m.label}
                        whileHover={{ y: -5 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setMood(m.label)}
                        className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-3xl transition-all border ${mood === m.label ? "bg-white border-rose-200 shadow-xl shadow-rose-100 ring-2 ring-rose-50" : "bg-white/50 border-transparent hover:bg-white"}`}
                      >
                        <span className="text-2xl">{m.emoji}</span>
                        <span className={`text-[8px] font-bold uppercase tracking-wider ${mood === m.label ? "text-rose-500" : "text-slate-400"}`}>{m.label}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Daily Insight */}
                <div className="bento-card bg-rose-50 border-rose-100/50 p-6 relative overflow-hidden group">
                  <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-rose-200/30 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700"></div>
                  <div className="relative z-10 flex gap-4">
                    <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-rose-500 shadow-sm">
                      <Sparkles size={20} />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-1">Daily Insight</h4>
                      <p className="text-xs font-medium text-slate-700 leading-relaxed italic">"Trust your body, it knows exactly how to nurture your little one."</p>
                    </div>
                  </div>
                </div>

                {/* Bento Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Next Appointment - Span 2 */}
                  <div className="col-span-2 bento-card flex items-center gap-5 group cursor-pointer" onClick={() => setActiveTab("calendar")}>
                    <div className="bg-rose-50 p-4 rounded-3xl text-rose-500 group-hover:rose-gradient group-hover:text-white transition-all duration-500">
                      <Calendar size={24} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Next Appointment</span>
                        <ChevronRight size={14} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
                      </div>
                      {appointments.filter(a => new Date(`${a.date}T${a.time}`) > new Date()).length > 0 ? (
                        <>
                          <h4 className="font-bold text-slate-800 text-base">{appointments.filter(a => new Date(`${a.date}T${a.time}`) > new Date())[0].title}</h4>
                          <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                            {new Date(appointments.filter(a => new Date(`${a.date}T${a.time}`) > new Date())[0].date).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })} • {appointments.filter(a => new Date(`${a.date}T${a.time}`) > new Date())[0].time}
                          </p>
                        </>
                      ) : (
                        <h4 className="font-bold text-slate-400 text-sm italic">No upcoming visits</h4>
                      )}
                    </div>
                  </div>

                  {/* Health Tips */}
                  <div className="bento-card space-y-4 group cursor-pointer hover:bg-blue-50/30">
                    <div className="w-12 h-12 bg-blue-500 rounded-[1.25rem] flex items-center justify-center text-white shadow-lg shadow-blue-200 group-hover:rotate-6 transition-transform">
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">Health Tips</h4>
                      <p className="text-[10px] text-slate-400 font-medium mt-1 leading-relaxed">Personalized advice for your week.</p>
                    </div>
                  </div>

                  {/* Resources */}
                  <div className="bento-card space-y-4 group cursor-pointer hover:bg-purple-50/30">
                    <div className="w-12 h-12 bg-purple-500 rounded-[1.25rem] flex items-center justify-center text-white shadow-lg shadow-purple-200 group-hover:-rotate-6 transition-transform">
                      <Info size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">Resources</h4>
                      <p className="text-[10px] text-slate-400 font-medium mt-1 leading-relaxed">Guides on pregnancy & care.</p>
                    </div>
                  </div>
                </div>

                {/* Stats / Progress Section */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bento-card bg-slate-900 text-white border-none overflow-hidden relative">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-rose-500/20 blur-3xl rounded-full"></div>
                    <div className="relative z-10">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Pregnancy</span>
                      <h4 className="text-xl font-serif italic font-medium">Week 24</h4>
                      <p className="text-[10px] text-slate-400 mt-1">Baby is the size of a <span className="text-rose-400 font-bold">Corn</span></p>
                      <div className="mt-4 w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: "60%" }}
                          className="h-full rose-gradient"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bento-card bg-white border-slate-100 flex flex-col justify-between group cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 group-hover:amber-gradient group-hover:text-white transition-all">
                        <Sparkles size={18} />
                      </div>
                      <span className="text-[10px] font-bold text-amber-500">Daily</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">Kick Counter</h4>
                      <p className="text-[10px] text-slate-400 font-medium mt-1">Track baby's movement.</p>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Quick Support</h3>
                  <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                    {["Nutrition", "Exercise", "Sleep", "Mental Health", "Emergency"].map((item) => (
                      <button key={item} className="whitespace-nowrap px-5 py-3 bg-white border border-slate-100 rounded-2xl text-[10px] font-bold text-slate-600 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-100 transition-all shadow-sm">
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "chat" && (
              <motion.div
                key="chat"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                className="flex-1 flex flex-col overflow-hidden bg-[#FBF9F8]"
              >
                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8 scroll-smooth no-scrollbar">
                  <AnimatePresence initial={false}>
                    {messages.map((msg, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div className={`max-w-[88%] px-6 py-4 rounded-[2.5rem] text-sm leading-relaxed shadow-sm relative ${
                          msg.role === "user"
                            ? "rose-gradient text-white rounded-tr-lg soft-shadow"
                            : "bg-white text-slate-700 rounded-tl-lg border border-slate-100/50 soft-shadow"
                        }`}>
                          {msg.role === "bot" ? (
                            <div className="markdown-body">
                              <Markdown>{msg.text}</Markdown>
                            </div>
                          ) : (
                            <p className="font-medium">{msg.text}</p>
                          )}
                          
                          {msg.role === "bot" && index !== 0 && (
                            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-4">
                              <button
                                onClick={() => handleFeedback(index, "up")}
                                className={`p-2 rounded-2xl transition-all ${msg.feedback?.rating === "up" ? "bg-green-50 text-green-600" : "text-slate-300 hover:bg-slate-50 hover:text-slate-400"}`}
                              >
                                <ThumbsUp size={14} fill={msg.feedback?.rating === "up" ? "currentColor" : "none"} />
                              </button>
                              <button
                                onClick={() => handleFeedback(index, "down")}
                                className={`p-2 rounded-2xl transition-all ${msg.feedback?.rating === "down" ? "bg-red-50 text-red-600" : "text-slate-300 hover:bg-slate-50 hover:text-slate-400"}`}
                              >
                                <ThumbsDown size={14} fill={msg.feedback?.rating === "down" ? "currentColor" : "none"} />
                              </button>
                              <button 
                                onClick={() => setFeedbackIndex(feedbackIndex === index ? null : index)}
                                className={`p-2 rounded-2xl transition-all ${feedbackIndex === index ? "bg-rose-50 text-rose-500" : "text-slate-300 hover:bg-slate-50 hover:text-slate-400"}`}
                              >
                                <MessageSquare size={14} />
                              </button>
                            </div>
                          )}

                          {feedbackIndex === index && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              className="mt-4 space-y-3"
                            >
                              <textarea
                                value={feedbackText}
                                onChange={(e) => setFeedbackText(e.target.value)}
                                placeholder="Tell us more..."
                                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-rose-400 transition-all resize-none h-20"
                              />
                              <button
                                onClick={() => submitTextFeedback(index)}
                                className="w-full py-2.5 bg-rose-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-rose-200"
                              >
                                Submit Feedback
                              </button>
                            </motion.div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {isLoading && (
                    <div className="flex items-center gap-3 text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] ml-4">
                      <div className="flex gap-1">
                        <motion.span animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1 h-1 bg-rose-400 rounded-full"></motion.span>
                        <motion.span animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1 h-1 bg-rose-400 rounded-full"></motion.span>
                        <motion.span animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1 h-1 bg-rose-400 rounded-full"></motion.span>
                      </div>
                      <span>AI is thinking</span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="px-8 py-6 bg-white/80 backdrop-blur-md border-t border-slate-100 space-y-4 relative">
                  {/* Quick Actions Menu */}
                  <AnimatePresence>
                    {showQuickActions && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute bottom-full left-8 right-8 mb-4 bg-white rounded-[2rem] shadow-2xl border border-slate-100 p-4 z-50"
                      >
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: "Diet Advice", icon: "🥗" },
                            { label: "Exercise", icon: "🧘‍♀️" },
                            { label: "Sleep Tips", icon: "🌙" },
                            { label: "Labor Signs", icon: "⚠️" },
                          ].map((item) => (
                            <button
                              key={item.label}
                              onClick={() => {
                                setInput(`Tell me about ${item.label.toLowerCase()}`);
                                setShowQuickActions(false);
                              }}
                              className="flex items-center gap-3 p-3 hover:bg-rose-50 rounded-2xl transition-all text-left"
                            >
                              <span className="text-lg">{item.icon}</span>
                              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{item.label}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Suggested Questions */}
                  <div className="flex gap-2 overflow-x-auto no-scrollbar">
                    <button
                      onClick={() => setShowQuickActions(!showQuickActions)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-bold transition-all shadow-sm border ${showQuickActions ? "bg-rose-500 text-white border-rose-500" : "bg-white text-rose-500 border-rose-100"}`}
                    >
                      <Plus size={14} className={showQuickActions ? "rotate-45 transition-transform" : "transition-transform"} />
                      Quick Actions
                    </button>
                    {suggestedQuestions.map((q) => (
                      <button
                        key={q.text}
                        onClick={() => {
                          setInput(q.text);
                          sendMessage();
                        }}
                        className="whitespace-nowrap flex items-center gap-2 px-4 py-2 bg-white border border-slate-100 rounded-full text-[10px] font-bold text-slate-500 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-100 transition-all shadow-sm"
                      >
                        <span>{q.icon}</span>
                        {q.text}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 bg-slate-50 rounded-[2.5rem] p-2 border border-slate-100 focus-within:ring-2 focus-within:ring-rose-400 focus-within:bg-white transition-all duration-300">
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={startListening}
                      className={`p-3.5 rounded-full transition-all ${isListening ? "bg-red-500 text-white shadow-lg shadow-red-200 animate-pulse" : "bg-white text-slate-400 shadow-sm border border-slate-100"}`}
                    >
                      {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                    </motion.button>
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask anything..."
                      className="flex-1 bg-transparent border-none outline-none text-sm px-2 text-slate-700 font-medium placeholder:text-slate-300"
                      onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    />
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={sendMessage}
                      disabled={!input.trim() || isLoading}
                      className={`p-3.5 rounded-full transition-all ${input.trim() && !isLoading ? "rose-gradient text-white shadow-lg shadow-rose-200" : "bg-slate-200 text-slate-400"}`}
                    >
                      <Send size={20} />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "calendar" && (
              <motion.div
                key="calendar"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                className="flex-1 overflow-y-auto px-8 py-6 space-y-8 no-scrollbar"
              >
                {/* Calendar View */}
                <div className="bento-card !p-8">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-serif italic font-medium text-slate-900">
                      {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </h3>
                    <div className="flex gap-2">
                      <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))} className="p-2.5 hover:bg-slate-50 rounded-2xl border border-slate-100 text-slate-400 transition-all"><ChevronLeft size={18} /></button>
                      <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))} className="p-2.5 hover:bg-slate-50 rounded-2xl border border-slate-100 text-slate-400 transition-all"><ChevronRight size={18} /></button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em] mb-6">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => <div key={d}>{d}</div>)}
                  </div>
                  
                  <div className="grid grid-cols-7 gap-3">
                    {getDaysInMonth(currentMonth).map((date, i) => {
                      if (!date) return <div key={`empty-${i}`} className="h-10" />;
                      const dateStr = date.toISOString().split('T')[0];
                      const dayAppts = appointments.filter(a => a.date === dateStr);
                      const isToday = new Date().toISOString().split('T')[0] === dateStr;
                      
                      return (
                        <motion.div 
                          key={dateStr} 
                          whileTap={{ scale: 0.9 }}
                          className={`h-11 flex flex-col items-center justify-center rounded-2xl text-xs relative transition-all cursor-pointer ${
                            isToday ? "rose-gradient text-white font-bold shadow-lg shadow-rose-200" : "hover:bg-rose-50 text-slate-600 border border-transparent hover:border-rose-100"
                          }`}
                        >
                          {date.getDate()}
                          {dayAppts.length > 0 && (
                            <div className={`absolute bottom-2 w-1 h-1 rounded-full ${isToday ? "bg-white" : "bg-rose-400"}`} />
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* Appointment List */}
                <div className="space-y-6 pb-24">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Upcoming Schedule</h3>
                    <motion.button 
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setShowAppointments(true)}
                      className="rose-gradient text-white p-3 rounded-2xl shadow-lg shadow-rose-200"
                    >
                      <Plus size={20} />
                    </motion.button>
                  </div>

                  <div className="space-y-4">
                    {appointments.length === 0 ? (
                      <div className="bento-card py-12 text-center border-dashed border-2">
                        <p className="text-xs text-slate-400 font-medium">No appointments scheduled</p>
                        <button onClick={() => setShowAppointments(true)} className="mt-4 text-xs font-bold text-rose-500 underline">Add your first visit</button>
                      </div>
                    ) : (
                      appointments.map(appt => (
                        <motion.div 
                          layout
                          key={appt.id} 
                          className="bento-card !p-5 flex flex-col gap-4 group relative overflow-hidden"
                        >
                          {editingApptId === appt.id ? (
                            <div className="space-y-4">
                              <div className="space-y-1.5">
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Title</label>
                                <input
                                  type="text"
                                  value={editApptData.title}
                                  onChange={e => setEditApptData(prev => ({ ...prev, title: e.target.value }))}
                                  className="w-full p-3 text-sm bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-rose-400 transition-all"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Date</label>
                                  <input
                                    type="date"
                                    value={editApptData.date}
                                    onChange={e => setEditApptData(prev => ({ ...prev, date: e.target.value }))}
                                    className="w-full p-3 text-sm bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-rose-400 transition-all"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Time</label>
                                  <input
                                    type="time"
                                    value={editApptData.time}
                                    onChange={e => setEditApptData(prev => ({ ...prev, time: e.target.value }))}
                                    className="w-full p-3 text-sm bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-rose-400 transition-all"
                                  />
                                </div>
                              </div>
                              <div className="flex gap-3 pt-2">
                                <button
                                  onClick={saveEdit}
                                  className="flex-1 py-3 bg-rose-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-rose-200 hover:bg-rose-600 transition-all flex items-center justify-center gap-2"
                                >
                                  <Save size={14} /> Save
                                </button>
                                <button
                                  onClick={() => setEditingApptId(null)}
                                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl text-xs font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                                >
                                  <X size={14} /> Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-5">
                              <div className="bg-slate-50 p-4 rounded-[1.5rem] text-slate-400 group-hover:bg-rose-50 group-hover:text-rose-500 transition-all duration-500">
                                <Clock size={22} />
                              </div>
                              <div className="flex-1">
                                <h4 className="font-bold text-slate-800 text-base">{appt.title}</h4>
                                <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-wider">
                                  {new Date(appt.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} • {appt.time}
                                </p>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                <button onClick={() => startEditing(appt)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                                  <Pencil size={18} />
                                </button>
                                <button onClick={() => removeAppointment(appt.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "profile" && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                className="flex-1 overflow-y-auto px-8 py-6 space-y-8 no-scrollbar"
              >
                <div className="flex flex-col items-center text-center space-y-4 py-8">
                  <div className="w-24 h-24 rounded-[2.5rem] rose-gradient flex items-center justify-center text-white shadow-2xl shadow-rose-200 relative">
                    <User size={40} />
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-white rounded-2xl flex items-center justify-center shadow-lg">
                      <Settings size={14} className="text-slate-400" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-serif italic font-medium text-slate-900">Mama Bear</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">24 Weeks Pregnant</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Your Journey</h3>
                  <div className="bento-card !p-0 overflow-hidden">
                    <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-rose-500 shadow-sm">
                          <Heart size={18} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800">Second Trimester</h4>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Week 13 - 27</p>
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-rose-100 text-rose-600 rounded-full text-[9px] font-bold">Active</span>
                    </div>
                    <div className="p-6 space-y-6">
                      {[
                        { week: "Week 12", label: "First Ultrasound", done: true },
                        { week: "Week 20", label: "Anatomy Scan", done: true },
                        { week: "Week 24", label: "Glucose Test", done: false },
                        { week: "Week 28", label: "Third Trimester", done: false },
                      ].map((step, i) => (
                        <div key={step.week} className="flex items-center gap-4 relative">
                          {i !== 3 && <div className={`absolute left-4 top-8 w-0.5 h-10 ${step.done ? "bg-rose-200" : "bg-slate-100"}`}></div>}
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center z-10 ${step.done ? "rose-gradient text-white shadow-lg shadow-rose-200" : "bg-slate-100 text-slate-300"}`}>
                            {step.done ? <Check size={14} /> : <div className="w-1.5 h-1.5 bg-slate-300 rounded-full"></div>}
                          </div>
                          <div className="flex-1">
                            <h5 className={`text-xs font-bold ${step.done ? "text-slate-800" : "text-slate-400"}`}>{step.label}</h5>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{step.week}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Account Settings</h3>
                  <div className="space-y-3">
                    {[
                      { icon: Bell, label: "Notifications", value: "On" },
                      { icon: Globe, label: "Language", value: languages[selectedLang].label },
                      { icon: Heart, label: "Health Profile", value: "Complete" },
                      { icon: Info, label: "Help & Support", value: "" },
                    ].map((item) => (
                      <div key={item.label} className="bento-card !p-4 flex items-center justify-between group cursor-pointer">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-rose-50 group-hover:text-rose-500 transition-all">
                            <item.icon size={18} />
                          </div>
                          <span className="text-xs font-bold text-slate-700">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.value && <span className="text-[10px] font-bold text-slate-300">{item.value}</span>}
                          <ChevronRight size={14} className="text-slate-300" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={clearHistory}
                  className="w-full py-4 bg-slate-50 text-slate-400 rounded-[2rem] text-[10px] font-bold uppercase tracking-widest hover:bg-red-50 hover:text-red-500 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 size={14} /> Clear Chat History
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom Navigation */}
        <div className="bg-white/80 backdrop-blur-md border-t border-slate-100 px-10 py-6 flex items-center justify-between sticky bottom-0 z-30">
          <button 
            onClick={() => setActiveTab("home")}
            className={`flex flex-col items-center gap-1.5 transition-all relative ${activeTab === "home" ? "text-rose-500" : "text-slate-300 hover:text-slate-400"}`}
          >
            <Home size={24} fill={activeTab === "home" ? "currentColor" : "none"} />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Home</span>
            {activeTab === "home" && <motion.div layoutId="nav-dot" className="absolute -bottom-2 w-1 h-1 bg-rose-500 rounded-full" />}
          </button>
          <button 
            onClick={() => setActiveTab("chat")}
            className={`flex flex-col items-center gap-1.5 transition-all relative ${activeTab === "chat" ? "text-rose-500" : "text-slate-300 hover:text-slate-400"}`}
          >
            <MessageSquare size={24} fill={activeTab === "chat" ? "currentColor" : "none"} />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Chat</span>
            {activeTab === "chat" && <motion.div layoutId="nav-dot" className="absolute -bottom-2 w-1 h-1 bg-rose-500 rounded-full" />}
          </button>
          <button 
            onClick={() => setActiveTab("calendar")}
            className={`flex flex-col items-center gap-1.5 transition-all relative ${activeTab === "calendar" ? "text-rose-500" : "text-slate-300 hover:text-slate-400"}`}
          >
            <Calendar size={24} fill={activeTab === "calendar" ? "currentColor" : "none"} />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Plan</span>
            {activeTab === "calendar" && <motion.div layoutId="nav-dot" className="absolute -bottom-2 w-1 h-1 bg-rose-500 rounded-full" />}
          </button>
          <button 
            onClick={() => setActiveTab("profile")}
            className={`flex flex-col items-center gap-1.5 transition-all relative ${activeTab === "profile" ? "text-rose-500" : "text-slate-300 hover:text-slate-400"}`}
          >
            <User size={24} fill={activeTab === "profile" ? "currentColor" : "none"} />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Profile</span>
            {activeTab === "profile" && <motion.div layoutId="nav-dot" className="absolute -bottom-2 w-1 h-1 bg-rose-500 rounded-full" />}
          </button>
        </div>

        {/* Appointment Modal Overlay */}
        <AnimatePresence>
          {showAppointments && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-6"
            >
              <motion.div
                initial={{ y: "100%", scale: 0.9 }}
                animate={{ y: 0, scale: 1 }}
                exit={{ y: "100%", scale: 0.9 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl space-y-8 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-2 rose-gradient opacity-50"></div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-serif italic font-medium text-slate-900">New Visit</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Schedule your next checkup</p>
                  </div>
                  <button onClick={() => setShowAppointments(false)} className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:bg-slate-100 hover:text-rose-500 transition-all"><X size={20} /></button>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Reason / Doctor</label>
                    <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-[1.5rem] border border-slate-100 focus-within:ring-2 focus-within:ring-rose-400 focus-within:bg-white transition-all group">
                      <Heart size={18} className="text-slate-300 group-focus-within:text-rose-400 transition-colors" />
                      <input
                        type="text"
                        placeholder="e.g. Dr. Smith Checkup"
                        value={newAppt.title}
                        onChange={e => setNewAppt(prev => ({ ...prev, title: e.target.value }))}
                        className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-slate-700 placeholder:text-slate-300"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Date</label>
                      <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-[1.5rem] border border-slate-100 focus-within:ring-2 focus-within:ring-rose-400 focus-within:bg-white transition-all group">
                        <Calendar size={18} className="text-slate-300 group-focus-within:text-rose-400 transition-colors" />
                        <input
                          type="date"
                          value={newAppt.date}
                          onChange={e => setNewAppt(prev => ({ ...prev, date: e.target.value }))}
                          className="flex-1 bg-transparent border-none outline-none text-xs font-bold text-slate-700"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Time</label>
                      <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-[1.5rem] border border-slate-100 focus-within:ring-2 focus-within:ring-rose-400 focus-within:bg-white transition-all group">
                        <Clock size={18} className="text-slate-300 group-focus-within:text-rose-400 transition-colors" />
                        <input
                          type="time"
                          value={newAppt.time}
                          onChange={e => setNewAppt(prev => ({ ...prev, time: e.target.value }))}
                          className="flex-1 bg-transparent border-none outline-none text-xs font-bold text-slate-700"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => { addAppointment(); setShowAppointments(false); }}
                  disabled={!newAppt.title || !newAppt.date || !newAppt.time}
                  className="w-full py-5 rose-gradient text-white rounded-[1.5rem] font-bold shadow-xl shadow-rose-200 hover:scale-[1.02] disabled:bg-slate-200 disabled:shadow-none transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <Check size={18} /> Confirm Appointment
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notification Toast */}
        <AnimatePresence>
          {activeNotification && (
            <motion.div
              initial={{ y: -120, opacity: 0, scale: 0.9 }}
              animate={{ y: 30, opacity: 1, scale: 1 }}
              exit={{ y: -120, opacity: 0, scale: 0.9 }}
              className="absolute top-0 left-6 right-6 z-[110]"
            >
              <div className="glass-dark text-white rounded-[2.5rem] p-6 shadow-2xl flex items-center gap-5">
                <div className="rose-gradient p-3 rounded-2xl shadow-lg shadow-rose-500/20">
                  <Bell size={24} className={activeNotification.isTwoDayNotification ? "animate-pulse" : "animate-bounce"} />
                </div>
                <div className="flex-1">
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-400 mb-0.5">
                    {activeNotification.isTwoDayNotification ? "Appointment Reminder" : "Upcoming Visit"}
                  </h4>
                  <p className="text-sm font-medium text-slate-100">
                    {activeNotification.isTwoDayNotification 
                      ? `${activeNotification.title} is on ${new Date(activeNotification.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${activeNotification.time}`
                      : `${activeNotification.title} at ${activeNotification.time}`
                    }
                  </p>
                </div>
                <button onClick={() => setActiveNotification(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20} /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default App;