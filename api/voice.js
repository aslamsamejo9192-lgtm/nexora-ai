// Text-to-speech through OpenRouter's HeyGen Voice Turbo (free) model.
// POST /api/voice { text, voice } -> audio/wav (44.1 kHz mono).
// The OpenRouter key lives only in the OPENROUTER_API_KEY env var — never in
// the page. The free model is $0 but rate-limited, and the free tier ends
// 30 Nov 2026 (after that the paid Turbo rate applies). HeyGen returns raw
// PCM only, so we wrap it in a WAV header here for plain <audio> playback.
var MODEL = "heygen/heygen-voice-1-turbo:free";
var VOICES = ["nadine", "tabitha", "bram", "gareth", "noelle", "meredith", "sabrina", "lucian", "weston", "vincent"];
var MAX_CHARS = 3000;

function pcmToWav(pcm, sampleRate) {
  var header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate (16-bit mono)
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

module.exports = async function (req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: { message: "Method not allowed." } });
    return;
  }
  var key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    res.status(503).json({
      error: {
        code: "KEY_NOT_CONFIGURED",
        message: "Voice replies aren't set up yet. The site owner needs to add OPENROUTER_API_KEY in the hosting settings."
      }
    });
    return;
  }
  var data = req.body || {};
  var text = String(data.text || "").trim().slice(0, MAX_CHARS);
  if (!text) {
    res.status(400).json({ error: { message: "No text to speak." } });
    return;
  }
  var voice = VOICES.indexOf(data.voice) === -1 ? "nadine" : data.voice;
  try {
    var upstream = await fetch("https://openrouter.ai/api/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + key,
        "HTTP-Referer": "https://nexora-ai-aslamsamejo9192-5091.vercel.app/",
        "X-Title": "Nexora AI"
      },
      body: JSON.stringify({ model: MODEL, input: text, voice: voice, response_format: "pcm" })
    });
    if (!upstream.ok) {
      var errText = await upstream.text();
      var message = "Voice service failed (" + upstream.status + ").";
      try {
        var j = JSON.parse(errText);
        if (j && j.error && j.error.message) message = j.error.message;
      } catch (_) {}
      if (upstream.status === 429) message = "Voice service is busy right now (free tier limit). Try again in a moment.";
      res.status(upstream.status === 429 ? 429 : 502).json({ error: { message: message } });
      return;
    }
    var pcm = Buffer.from(await upstream.arrayBuffer());
    if (!pcm.length) {
      res.status(502).json({ error: { message: "Voice service returned no audio." } });
      return;
    }
    var wav = pcmToWav(pcm, 44100);
    res.writeHead(200, {
      "Content-Type": "audio/wav",
      "Content-Length": wav.length,
      "Cache-Control": "no-store"
    });
    res.end(wav);
  } catch (e) {
    if (!res.headersSent) {
      res.status(502).json({ error: { message: "Could not reach the voice service. Try again in a moment." } });
    } else {
      try { res.end(); } catch (_) {}
    }
  }
};
