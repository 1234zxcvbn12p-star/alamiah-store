const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();

// Vercel يسمح بالكتابة فقط داخل المجلد المؤقت /tmp
const dbPath = process.env.VERCEL ? '/tmp/database.db' : path.join(__dirname, 'database.db');

if (process.env.VERCEL && fs.existsSync(path.join(__dirname, 'database.db')) && !fs.existsSync(dbPath)) {
    try {
        fs.copyFileSync(path.join(__dirname, 'database.db'), dbPath);
    } catch (e) {
        console.error("Failed to copy database file:", e);
    }
}

const db = new sqlite3.Database(dbPath);

// إنشاء الجداول تلقائياً لتفادي أخطاء الاستعلام
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id TEXT,
        name TEXT,
        comment TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender TEXT,
        message TEXT,
        product_name TEXT,
        product_price TEXT,
        product_image TEXT
    )`);
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const auth = (req, res, next) => next();

// API Routes
app.get('/api/video/comments/:id', (req, res) => {
    db.all("SELECT * FROM comments WHERE video_id = ? ORDER BY id DESC", [req.params.id], (err, comments) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ comments: comments || [] });
    });
});

app.post('/api/video/comment/:id', (req, res) => {
    const name = req.body.name || 'زائر';
    const comment = req.body.comment;
    db.run("INSERT INTO comments (video_id, name, comment) VALUES (?, ?, ?)", [req.params.id, name, comment], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        db.all("SELECT * FROM comments WHERE video_id = ? ORDER BY id DESC", [req.params.id], (err, comments) => {
            res.json({ comments: comments || [] });
        });
    });
});

app.get('/api/chat/messages', (req, res) => {
    db.all("SELECT * FROM messages ORDER BY id ASC", [], (err, messages) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ messages: messages || [] });
    });
});

app.post('/api/chat/send', (req, res) => {
    const { sender, message, product_name, product_price, product_image } = req.body;
    db.run(
        "INSERT INTO messages (sender, message, product_name, product_price, product_image) VALUES (?, ?, ?, ?, ?)",
        [sender || 'عميل', message || '', product_name || null, product_price || null, product_image || null],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            db.all("SELECT * FROM messages ORDER BY id ASC", [], (err, messages) => {
                res.json({ messages: messages || [] });
            });
        }
    );
});

app.post('/api/chat/clear', auth, (req, res) => {
    db.run("DELETE FROM messages", [], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// الصفحة الرئيسية
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.send("المتجر يعمل بنجاح!");
    }
});

if (!process.env.VERCEL) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;

