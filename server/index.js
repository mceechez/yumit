import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import claudeRoutes from './routes/claude.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased limit for base64 images

// Routes
app.use('/api/claude', claudeRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Yumit API server running on port ${PORT}`);
});
