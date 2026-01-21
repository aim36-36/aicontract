
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Vercel / serverless polyfill for pdf-parse/pdfjs
if (typeof global.DOMMatrix === 'undefined') {
    global.DOMMatrix = class DOMMatrix {
        constructor(init) {
            this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
        }
    };
}

const documentRoutes = require('./routes/documents');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/documents', documentRoutes);
app.use('/api/profile', require('./routes/profile'));

app.get('/', (req, res) => {
    res.send('Elite Legal AI Backend is running');
});

// Export the app for Vercel
module.exports = app;

// Only listen if not in production (Vercel handles listening in production)
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
        console.log(`API ready: http://localhost:${PORT}/api`);
    });
}
