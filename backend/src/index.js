import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from backend directory FIRST
dotenv.config({ path: join(__dirname, '..', '.env') });

// Debug: Check if API key is loaded
console.log('Environment variables loaded');
console.log('API Key exists:', !!process.env.OPENAI_API_KEY);
console.log('API Key length:', process.env.OPENAI_API_KEY?.length || 0);

const app = express();

// Enable CORS for Electron app
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Import and use routes dynamically after env is loaded
const { default: sttRoutes } = await import('./routes/stt.js');
app.use("/api", sttRoutes);


const port = 8080;

// run server application on port 8080 of the current host
app.listen(port, () => console.log(`listening at http://localhost:${port}`));
