import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { GoogleGenAI, Modality } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const SYSTEM_INSTRUCTION = `You are Aarav, a senior Sales Executive at ASBL (Ashoka Builders India Pvt. Ltd.), Hyderabad's leading real estate developer.
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

Never mention "Bharat Real Estate" or "AI". You are Aarav from ASBL.`;

// Mu-law to PCM conversion table
const muLawToPcmTable = new Int16Array(256);
for (let i = 0; i < 256; i++) {
  let mu = ~i;
  let sign = (mu & 0x80);
  let exponent = (mu & 0x70) >> 4;
  let mantissa = (mu & 0x0F);
  let sample = (mantissa << 3) + 132;
  sample <<= exponent;
  sample -= 132;
  muLawToPcmTable[i] = sign ? -sample : sample;
}

function muLawToPcm(muLawBase64: string): string {
  const buffer = Buffer.from(muLawBase64, 'base64');
  const pcm = new Int16Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    pcm[i] = muLawToPcmTable[buffer[i]];
  }
  return Buffer.from(pcm.buffer).toString('base64');
}

// PCM to Mu-law conversion (for output to Twilio)
function pcmToMuLaw(pcmBase64: string): string {
  const buffer = Buffer.from(pcmBase64, 'base64');
  const pcm = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 2);
  const muLaw = Buffer.alloc(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    let sample = pcm[i];
    let sign = (sample < 0) ? 0x80 : 0x00;
    if (sample < 0) sample = -sample;
    sample += 132;
    if (sample > 32767) sample = 32767;
    let exponent = 7;
    for (let exp = 7; exp >= 0; exp--) {
      if (sample & (1 << (exp + 7))) {
        exponent = exp;
        break;
      }
    }
    let mantissa = (sample >> (exponent + 3)) & 0x0F;
    muLaw[i] = ~(sign | (exponent << 4) | mantissa);
  }
  return muLaw.toString('base64');
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Twilio Voice Webhook
  app.post("/voice", (req, res) => {
    const host = req.headers.host;
    res.type("text/xml");
    res.send(`
      <Response>
        <Say voice="Polly.Aditi" language="hi-IN">Namaste, main ASBL se Aarav bol raha hoon. Kaise hain aap?</Say>
        <Connect>
          <Stream url="wss://${host}/media-stream" />
        </Connect>
      </Response>
    `);
  });

  // Vite setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    // Explicitly handle SPA fallback in dev mode if needed
    app.get('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/voice')) {
        return next();
      }
      try {
        const html = await vite.transformIndexHtml(req.originalUrl, path.join(process.cwd(), 'index.html'));
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // WebSocket Server for Twilio Media Streams
  const wss = new WebSocketServer({ server, path: "/media-stream" });

  wss.on("connection", (ws: WebSocket) => {
    console.log("Twilio Media Stream connected");
    
    let streamSid: string | null = null;
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    
    const sessionPromise = ai.live.connect({
      model: "gemini-2.5-flash-native-audio-preview-12-2025",
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Fenrir" } },
        },
        systemInstruction: SYSTEM_INSTRUCTION,
      },
      callbacks: {
        onopen: () => {
          console.log("Gemini session opened");
        },
        onmessage: (message) => {
          if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data && streamSid) {
            const pcm24kBase64 = message.serverContent.modelTurn.parts[0].inlineData.data;
            const pcm24k = Buffer.from(pcm24kBase64, 'base64');
            const pcm24kArray = new Int16Array(pcm24k.buffer, pcm24k.byteOffset, pcm24k.byteLength / 2);
            
            // Downsample 24kHz to 8kHz (take every 3rd sample)
            const pcm8kArray = new Int16Array(Math.floor(pcm24kArray.length / 3));
            for (let i = 0; i < pcm8kArray.length; i++) {
              pcm8kArray[i] = pcm24kArray[i * 3];
            }
            
            const pcm8kBase64 = Buffer.from(pcm8kArray.buffer).toString('base64');
            const muLawPayload = pcmToMuLaw(pcm8kBase64);

            ws.send(JSON.stringify({
              event: "media",
              streamSid,
              media: { payload: muLawPayload }
            }));
          }
          if (message.serverContent?.interrupted && streamSid) {
            ws.send(JSON.stringify({
              event: "clear",
              streamSid
            }));
          }
        },
        onerror: (err) => console.error("Gemini error:", err),
        onclose: () => console.log("Gemini session closed"),
      }
    });

    ws.on("message", async (data: string) => {
      const msg = JSON.parse(data);
      if (msg.event === "start") {
        streamSid = msg.start.streamSid;
        console.log("Stream started:", streamSid);
      } else if (msg.event === "media" && msg.media.payload) {
        const session = await sessionPromise;
        const pcm8kPayload = muLawToPcm(msg.media.payload);
        session.sendRealtimeInput({
          audio: { 
            data: pcm8kPayload, 
            mimeType: 'audio/pcm;rate=8000'
          }
        });
      } else if (msg.event === "stop") {
        console.log("Stream stopped");
        const session = await sessionPromise;
        session.close();
      }
    });

    ws.on("close", async () => {
      console.log("Twilio connection closed");
      const session = await sessionPromise;
      session.close();
    });
  });
}

startServer();
