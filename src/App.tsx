import React, { useState } from 'react';
import VoiceAgent from './components/VoiceAgent';
import { Sparkles, Upload, Zap, Shield, Globe, MessageSquare, FileText, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

export default function App() {
  const [kbContent, setKbContent] = useState<string | null>(null);
  const [kbFileName, setKbFileName] = useState<string | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setKbContent(content);
        setKbFileName(file.name);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-purple-500/30 relative overflow-hidden">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <motion.div 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex items-center gap-3 group cursor-pointer"
          >
            <div className="w-10 h-10 bg-gradient-to-tr from-purple-600 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform">
              <Sparkles className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              Dancing Monkey <span className="text-purple-500">AI</span>
            </h1>
          </motion.div>
          <nav className="hidden md:flex gap-8 text-sm font-medium uppercase tracking-widest text-gray-400">
            <a href="#features" className="hover:text-white transition-colors">Capabilities</a>
            <a href="#kb" className="hover:text-white transition-colors">Knowledge Base</a>
            <a href="#about" className="hover:text-white transition-colors">About</a>
            <a href="#agent" className="hover:text-white transition-colors px-4 py-2 bg-white/5 rounded-full border border-white/10">Try Agent</a>
          </nav>
        </div>
      </header>

      <main className="pt-32 pb-20 relative z-10">
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-20 items-center mb-32">
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="space-y-8"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/10 text-purple-400 rounded-full text-xs font-bold uppercase tracking-widest border border-purple-500/20">
              <Zap className="w-3 h-3" />
              Next-Gen Conversational AI
            </div>
            
            <h2 className="text-6xl lg:text-8xl font-bold leading-[1.05] tracking-tight">
              Your AI, <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">Your Data.</span>
            </h2>
            
            <p className="text-xl text-gray-400 leading-relaxed max-w-lg">
              Dancing Monkey AI isn't just another chatbot. It's a specialized agent that learns from your specific knowledge base to provide accurate, context-aware assistance.
            </p>

            <div className="flex flex-wrap gap-4">
              <a href="#agent" className="px-8 py-4 bg-white text-black font-bold rounded-2xl hover:bg-gray-200 transition-all hover:scale-105 active:scale-95">
                Launch Agent
              </a>
              <a href="#kb" className="px-8 py-4 bg-white/5 border border-white/10 font-bold rounded-2xl hover:bg-white/10 transition-all flex items-center gap-2 hover:scale-105 active:scale-95">
                <Upload className="w-5 h-5" /> Upload Knowledge
              </a>
            </div>
          </motion.div>

          <motion.div 
            id="agent" 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="relative"
          >
            <div className="absolute -inset-10 bg-purple-600/20 blur-[120px] rounded-full opacity-50 animate-pulse" />
            <VoiceAgent customKb={kbContent} />
          </motion.div>
        </section>

        {/* Features Section */}
        <section id="features" className="max-w-7xl mx-auto px-6 mb-32">
          <div className="text-center mb-16">
            <h3 className="text-sm font-bold uppercase tracking-[0.3em] text-purple-500 mb-4">Capabilities</h3>
            <h2 className="text-4xl font-bold">What Dancing Monkey AI Can Do</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <MessageSquare className="w-8 h-8 text-purple-500" />,
                title: "Natural Conversations",
                desc: "Engage in fluid, human-like voice interactions in multiple languages."
              },
              {
                icon: <FileText className="w-8 h-8 text-pink-500" />,
                title: "Custom Knowledge",
                desc: "Upload your PDFs, docs, or text files to train the agent on your specific business data."
              },
              {
                icon: <Shield className="w-8 h-8 text-blue-500" />,
                title: "Secure & Private",
                desc: "Your data is processed securely and used only for your specific agent session."
              }
            ].map((feature, i) => (
              <motion.div 
                key={i} 
                initial={{ y: 20, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-8 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-colors group"
              >
                <div className="mb-6 group-hover:scale-110 transition-transform">{feature.icon}</div>
                <h4 className="text-xl font-bold mb-4">{feature.title}</h4>
                <p className="text-gray-400 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* About Section */}
        <section id="about" className="max-w-7xl mx-auto px-6 mb-32">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <motion.div
              initial={{ x: -50, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="absolute -inset-4 bg-gradient-to-tr from-purple-600/20 to-pink-500/20 blur-3xl rounded-full" />
              <div className="relative p-1 bg-gradient-to-tr from-purple-600 to-pink-500 rounded-[3rem]">
                <div className="bg-[#0a0a0a] rounded-[2.8rem] p-10 space-y-6">
                  <h3 className="text-sm font-bold uppercase tracking-[0.3em] text-purple-500">The Creator</h3>
                  <h2 className="text-4xl font-bold">Balmukund Tripathi</h2>
                  <p className="text-gray-400 leading-relaxed">
                    A Computer Science engineer and Senior Growth Associate at ASBL, Balmukund specializes in AI automation and autonomous sales systems. With a background in building LLM chatbots and AI calling agents, he created Dancing Monkey AI to bridge the gap between raw data and intelligent conversation.
                  </p>
                  <div className="flex gap-4 pt-4">
                    <a href="https://linkedin.com/in/balmukund01" target="_blank" className="text-xs font-bold uppercase tracking-widest text-purple-400 hover:text-white transition-colors">LinkedIn</a>
                    <a href="https://github.com/1Mukund" target="_blank" className="text-xs font-bold uppercase tracking-widest text-purple-400 hover:text-white transition-colors">GitHub</a>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ x: 50, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              viewport={{ once: true }}
              className="space-y-8"
            >
              <h3 className="text-sm font-bold uppercase tracking-[0.3em] text-pink-500">The Vision</h3>
              <h2 className="text-5xl font-bold leading-tight">Zero-Touch, <br />High-Impact Automation.</h2>
              <p className="text-xl text-gray-400 leading-relaxed">
                "My vision is a world where AI agents handle the routine, allowing humans to focus on creativity and strategy. Dancing Monkey AI is built to empower businesses and individuals to have their own specialized AI agent that knows their data inside out."
              </p>
              <div className="space-y-4">
                {[
                  "Eliminating human dependency in sales",
                  "Fully autonomous digital sales layers",
                  "Accessible AI for everyone"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-purple-500" />
                    <span className="text-gray-300 font-medium">{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* KB Upload Section */}
        <section id="kb" className="max-w-3xl mx-auto px-6 py-20 bg-gradient-to-b from-purple-900/20 to-transparent rounded-[4rem] border border-white/5 text-center">
          <h3 className="text-3xl font-bold mb-6">Upload Your Knowledge Base</h3>
          <p className="text-gray-400 mb-10">
            Upload a text file containing your business details, FAQs, or any information you want the AI to know.
          </p>
          
          <div className="relative group">
            <input 
              type="file" 
              accept=".txt,.md" 
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className={`p-12 border-2 border-dashed rounded-3xl transition-all ${
              kbFileName ? 'border-green-500/50 bg-green-500/5' : 'border-white/10 group-hover:border-purple-500/50 group-hover:bg-purple-500/5'
            }`}>
              {kbFileName ? (
                <div className="flex flex-col items-center gap-4">
                  <CheckCircle2 className="w-12 h-12 text-green-500" />
                  <div>
                    <p className="font-bold text-lg">{kbFileName}</p>
                    <p className="text-sm text-green-500/70 uppercase tracking-widest">Knowledge Base Loaded</p>
                  </div>
                  <button 
                    onClick={() => { setKbContent(null); setKbFileName(null); }}
                    className="mt-4 text-xs text-gray-500 hover:text-white underline underline-offset-4"
                  >
                    Remove and upload another
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <Upload className="w-12 h-12 text-gray-500 group-hover:text-purple-500 transition-colors" />
                  <p className="text-gray-400">Click or drag to upload .txt or .md files</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-white/5 text-center relative z-10">
        <p className="text-gray-500 text-sm tracking-widest uppercase">
          © 2026 Dancing Monkey AI. Built by Balmukund Tripathi.
        </p>
      </footer>
    </div>
  );
}
