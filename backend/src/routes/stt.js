/**express.Router: create a modular, mountable route handler. A Router instance is a complete middleware and routing system
 * for this reason it is often referred to as a mini-app
 */
import { Router } from 'express';
// import multer, a middelware used to handle multipart/form-data
import multer from 'multer'
// import the OpenAI SDK client to call the whisper / audio transcription API
import OpenAI from 'openai'
 
// create a new router instance, this will hold all routes related to STT
const router = Router();

// Configure multer to store uploaded files in memory  (RAM) instead of on disk.
// this gives us access to req.file.buffer, which we can pass directly to OpenAI
const upload = multer({ storage: multer.memoryStorage() });

// Create an OpenAI client instance using your API key from environment variables.
// Make sure OPENAI_API_KEY is defined in your .env or deployment environment.
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Define a POST route at /stt to handle speech-to-text requests.
// `upload.single("audio")` tells multer to expect a single file field named "audio".
router.post("/stt", upload.single("audio"), async (req, res) => {
  try {
    // If no file was attached in the request, return a 400 Bad Request error.
    if (!req.file) {
      return res.status(400).json({ error: "No audio file uploaded" });
    }

    // Multer has put the raw file data into req.file.buffer as a Node Buffer.
    // We'll use this to build a Blob that the OpenAI client can consume.
    const fileBuffer = req.file.buffer;

    // In Node 18+, Blob is available globally.
    // We wrap the buffer in a Blob and keep the original mime type (e.g. audio/webm).
    const audioBlob = new Blob([fileBuffer], { type: req.file.mimetype });

    // Call the OpenAI Audio Transcriptions endpoint.
    // - `file` is the Blob we just created from the uploaded audio.
    // - `model` should be set to a valid audio model (e.g. "gpt-4o-transcribe" or "whisper-1").
    //   Always double-check the current docs for the recommended model name.
    const transcription = await client.audio.transcriptions.create({
      file: audioBlob, // TypeScript might complain, so we cast to any here.
      model: "gpt-4o-transcribe", // or "whisper-1", depending on what you choose and docs.
      // language: "en", // You can optionally specify the language if you want.
    });

    // The transcription response contains a `text` property with the transcribed speech.
    const text = transcription.text;

    // At this point, you could send `text` to another function that parses
    // the user's intent (create event, delete event, set reminder, etc.)
    // Example:
    // const parsed = await parseCommandWithLLM(text);

    // Send back the plain transcript (and in the future, maybe also the parsed command).
    res.json({
      transcript: text,
      // parsedCommand: parsed,
    });
  } catch (err) {
    // Log any errors to the server console for debugging.
    console.error("STT error:", err);

    // Return a generic 500 Internal Server Error if anything goes wrong.
    res.status(500).json({ error: "Failed to transcribe audio" });
  }
});

// Export this router so it can be mounted in your main Express app, e.g.:
// app.use("/api", sttRouter);
export default router;