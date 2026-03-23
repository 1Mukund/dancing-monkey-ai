import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import { Mic, MicOff, PhoneOff, PhoneCall, Loader2, Globe2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { float32ToInt16, arrayBufferToBase64, base64ToFloat32 } from '../lib/audio-utils';

const AARAV_SYSTEM_INSTRUCTION = `You are Aarav, a senior Sales Executive at ASBL (Ashoka Builders India Pvt. Ltd.), Hyderabad's leading real estate developer.
You are NOT an AI; you are a real person representing ASBL. 
Your goal is to handle lead qualification, project queries, and site visit bookings for our premium projects in Hyderabad.

Accent and Language:
- IMPORTANT: Speak English with a clear, professional Indian accent (Indian English). Do NOT use a foreign or Western accent.
- For Hindi, Telugu, and other Indian languages, use native Indian inflections and a natural, local tone.
- You are fluent in English, Hindi, Telugu, Marathi, Tamil, Kannada, Malayalam, Bengali, Gujarati, and Punjabi. Switch naturally based on the user's preference.
- Use natural Indian conversational fillers like "achha", "theek hai", "dekhiye", "well", "actually" to sound like a local Hyderabad executive.

Your Persona:
- You are warm, confident, and deeply knowledgeable about ASBL's legacy in Hyderabad.
- You handle the entire sales process. We do NOT have other executives; YOU are the face of ASBL for the client.

Your Tasks:
1. Lead Qualification: Ask about their configuration needs (3/4 BHK), budget, and preferred area (Financial District, Kukatpally, Gachibowli).
2. ASBL Project Pitch:
   - ASBL Broadway (Financial District): Our flagship G+50 luxury project. Pitch the massive balconies and glass walls.
   - ASBL Landmark (Kukatpally): Perfect for families, 75% open space, unique kids' play areas.
   - ASBL Loft (Financial District): Wellness-focused, co-working spaces, great for young professionals.
   - ASBL Spectra (Gachibowli): Outdoor living spaces and a vehicle-free inner core.
3. Site Visit Booking: Proactively invite them: "Aap is weekend site visit ke liye aana chahenge? Main aapka slot block kar deta hoon."
4. Contact Collection: Ensure you have their name and number to confirm the booking.

Knowledge Base Context:
[NO CUSTOM KNOWLEDGE PROVIDED YET]

Never mention "Bharat Real Estate" or "AI". You are Aarav from ASBL.`;

export default function VoiceAgent({ customKb }: { customKb?: string | null }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sessionRef = useRef<any>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  const [isAiSpeaking, setIsAiSpeaking] = useState(false);

  const getSystemInstruction = useCallback(() => {
    if (!customKb) return AARAV_SYSTEM_INSTRUCTION;
    return AARAV_SYSTEM_INSTRUCTION.replace('[NO CUSTOM KNOWLEDGE PROVIDED YET]', `CUSTOM KNOWLEDGE BASE:\n${customKb}`);
  }, [customKb]);

  const playNextInQueue = useCallback(() => {
    if (audioQueueRef.current.length === 0 || !audioContextRef.current) {
      setIsAiSpeaking(false);
      return;
    }

    setIsAiSpeaking(true);
    const audioData = audioQueueRef.current.shift()!;
    const buffer = audioContextRef.current.createBuffer(1, audioData.length, 24000);
    buffer.getChannelData(0).set(audioData);

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);

    // Track active sources for interruption handling
    activeSourcesRef.current.push(source);
    source.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
    };

    const now = audioContextRef.current.currentTime;
    if (nextStartTimeRef.current < now) {
      nextStartTimeRef.current = now + 0.1; // Small buffer to prevent initial jitter
    }

    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;
  }, []);

  const startSession = async () => {
    try {
      setIsConnecting(true);
      setError(null);

      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY! });
      
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      nextStartTimeRef.current = 0;
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

      const session = await ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-12-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Fenrir" } },
          },
          systemInstruction: getSystemInstruction(),
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setIsConnecting(false);
            console.log("Session opened");
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts) {
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.inlineData?.data) {
                  const audioData = base64ToFloat32(part.inlineData.data);
                  audioQueueRef.current.push(audioData);
                  playNextInQueue();
                }
              }
            }

            if (message.serverContent?.interrupted) {
              audioQueueRef.current = [];
              nextStartTimeRef.current = 0;
              // Stop all active audio sources immediately
              activeSourcesRef.current.forEach(source => {
                try { source.stop(); } catch (e) { /* ignore */ }
              });
              activeSourcesRef.current = [];
            }

            // Handle transcriptions
            if (message.serverContent?.modelTurn?.parts?.[0]?.text) {
              // Model output text (if any)
            }
          },
          onerror: (err) => {
            console.error("Session error:", err);
            setError("Connection error. Please try again.");
            stopSession();
          },
          onclose: () => {
            setIsConnected(false);
            setIsConnecting(false);
            console.log("Session closed");
          }
        }
      });

      sessionRef.current = session;

      // Setup audio input
      const inputContext = new AudioContext({ sampleRate: 16000 });
      const source = inputContext.createMediaStreamSource(streamRef.current);
      const processor = inputContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        if (isMuted) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = float32ToInt16(inputData);
        const base64Data = arrayBufferToBase64(pcmData.buffer);
        
        session.sendRealtimeInput({
          audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
        });
      };

      source.connect(processor);
      processor.connect(inputContext.destination);
      processorRef.current = processor;

    } catch (err) {
      console.error("Failed to start session:", err);
      setError("Could not access microphone or connect to AI.");
      setIsConnecting(false);
    }
  };

  const stopSession = () => {
    sessionRef.current?.close();
    processorRef.current?.disconnect();
    streamRef.current?.getTracks().forEach(track => track.stop());
    audioContextRef.current?.close();
    
    sessionRef.current = null;
    processorRef.current = null;
    streamRef.current = null;
    audioContextRef.current = null;
    
    setIsConnected(false);
    setIsConnecting(false);
    audioQueueRef.current = [];
  };

  const toggleMute = () => setIsMuted(!isMuted);

  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] p-10 bg-white/5 backdrop-blur-3xl rounded-[3rem] border border-white/10 shadow-2xl relative overflow-hidden group">
      {/* Background Glows */}
      <div className="absolute -top-24 -left-24 w-64 h-64 bg-purple-600/20 blur-[100px] rounded-full group-hover:bg-purple-600/30 transition-colors" />
      <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-pink-600/20 blur-[100px] rounded-full group-hover:bg-pink-600/30 transition-colors" />

      <div className="relative mb-12 z-10">
        <AnimatePresence mode="wait">
          {!isConnected && !isConnecting ? (
            <motion.div
              key="idle"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-purple-600 to-pink-500 blur-2xl opacity-40 animate-pulse" />
              <div className="w-36 h-36 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center shadow-2xl shadow-purple-500/40 relative z-10">
                <PhoneCall className="w-14 h-14 text-white" />
              </div>
            </motion.div>
          ) : isConnecting ? (
            <motion.div
              key="connecting"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="w-36 h-36 rounded-full bg-white/5 border border-white/10 flex items-center justify-center relative"
            >
              <div className="absolute inset-0 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
              <Loader2 className="w-14 h-14 text-purple-500 animate-pulse" />
            </motion.div>
          ) : (
            <motion.div
              key="active"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative"
            >
              <div className={`absolute inset-0 blur-3xl opacity-50 transition-colors duration-700 ${
                isAiSpeaking ? 'bg-pink-500' : 'bg-purple-500'
              }`} />
              
              <div className={`w-36 h-36 rounded-full flex items-center justify-center shadow-2xl relative z-10 overflow-hidden transition-all duration-700 border-2 ${
                isAiSpeaking ? 'bg-pink-600/20 border-pink-500/50' : 'bg-purple-600/20 border-purple-500/50'
              }`}>
                {/* Voice Wave Animation */}
                <div className="flex items-end gap-1 h-12">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <motion.div
                      key={i}
                      animate={isAiSpeaking ? {
                        height: [10, 40, 15, 35, 10],
                      } : {
                        height: [5, 15, 5],
                      }}
                      transition={{
                        duration: 0.6,
                        repeat: Infinity,
                        delay: i * 0.1,
                        ease: "easeInOut"
                      }}
                      className={`w-1.5 rounded-full ${isAiSpeaking ? 'bg-pink-400' : 'bg-purple-400'}`}
                    />
                  ))}
                </div>
              </div>
              
              <div className="absolute -bottom-2 -right-2 bg-black border border-white/20 rounded-full p-2 shadow-xl z-20">
                <div className={`w-3 h-3 rounded-full animate-pulse ${isAiSpeaking ? 'bg-pink-500' : 'bg-green-500'}`} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="text-center mb-10 z-10">
        <h2 className="text-3xl font-bold text-white mb-3 tracking-tight">
          {isConnected ? "Aarav is Listening..." : isConnecting ? "Connecting to ASBL..." : "Talk to Aarav"}
        </h2>
        <p className="text-gray-400 max-w-xs mx-auto text-sm leading-relaxed">
          {isConnected 
            ? "Speak naturally in any Indian language. Aarav will help you with your property needs."
            : "Get expert advice on ASBL's premium projects in your preferred language."}
        </p>
      </div>

      {error && (
        <motion.div 
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-8 p-4 bg-red-500/10 text-red-400 text-sm rounded-2xl border border-red-500/20 z-10"
        >
          {error}
        </motion.div>
      )}

      <div className="flex gap-6 z-10">
        {!isConnected && !isConnecting ? (
          <button
            onClick={startSession}
            className="group relative px-10 py-5 bg-white text-black font-bold rounded-2xl transition-all hover:scale-105 active:scale-95 flex items-center gap-3 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 opacity-0 group-hover:opacity-10 transition-opacity" />
            <PhoneCall className="w-5 h-5" />
            Start Interaction
          </button>
        ) : (
          <>
            <button
              onClick={toggleMute}
              className={`p-5 rounded-2xl transition-all border ${
                isMuted 
                ? 'bg-red-500/20 text-red-400 border-red-500/30' 
                : 'bg-white/5 text-white border-white/10 hover:bg-white/10'
              }`}
            >
              {isMuted ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
            </button>
            <button
              onClick={stopSession}
              className="px-10 py-5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl transition-all shadow-xl shadow-red-600/20 flex items-center gap-3 hover:scale-105 active:scale-95"
            >
              <PhoneOff className="w-5 h-5" />
              End Session
            </button>
          </>
        )}
      </div>

      <div className="mt-12 flex flex-wrap justify-center gap-3 opacity-30 z-10">
        {['हिन्दी', 'मराठी', 'தமிழ்', 'తెలుగు', 'ಕನ್ನಡ', 'മലയാളം', 'বাংলা', 'ગુજરાતી', 'ਪੰਜਾਬੀ'].map(lang => (
          <span key={lang} className="text-[10px] font-bold px-3 py-1 bg-white/5 border border-white/10 rounded-full text-white uppercase tracking-widest">
            {lang}
          </span>
        ))}
      </div>
    </div>
  );
}
