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
    const fileBuffer = req.file.buffer;

    // Create a File object (required by OpenAI SDK)
    // File constructor: new File(bits, name, options)
    const audioFile = new File(
      [fileBuffer], 
      'recording.webm',
      { type: req.file.mimetype || 'audio/webm' }
    );

    console.log('Processing audio file:', {
      size: fileBuffer.length,
      mimeType: audioFile.type
    });

    // Call the OpenAI Audio Transcriptions endpoint.
    const transcription = await client.audio.transcriptions.create({
      file: audioFile, 
      model: "whisper-1", // Using whisper-1 (most stable model)
    });

    // The transcription response contains a `text` property with the transcribed speech.
    const text = transcription.text;

    console.log('Transcription successful, length:', text.length);

    // Send back the plain transcript
    res.json({
      transcript: text,
    });
  } catch (err) {
    // Log any errors to the server console for debugging.
    console.error("STT error:", err);
    console.error("Error details:", err.message);

    // Return a generic 500 Internal Server Error if anything goes wrong.
    res.status(500).json({ error: "Failed to transcribe audio", details: err.message });
  }
});

// Export this router so it can be mounted in your main Express app, e.g.:
// app.use("/api", sttRouter);
export default router;