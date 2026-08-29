const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const db = new sqlite3.Database('./database.db');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Auth Middleware Placeholder
const auth = (req, res, next) => {
    if (typeof req.session !== 'undefined' && req.session.user) {
        next();
    } else {
        next(); // يمكن تعديلها بحسب نظام التوثيق لديك
    }
};

// API Routes
app.get('/api/video/comments/:id', (req, res) => {
    db.all("SELECT * FROM comments WHERE video_id = ? ORDER BY id DESC", [req.params.id], (err, comments) => {
        res.json({ comments: comments || [] });
    });
});

app.post('/api/video/comment/:id', (req, res) => {
    const name = req.body.name || 'زائر';
    const comment = req.body.comment;
    db.run("INSERT INTO comments (video_id, name, comment) VALUES (?, ?, ?)", [req.params.id, name, comment], function() {
        db.all("SELECT * FROM comments WHERE video_id = ? ORDER BY id DESC", [req.params.id], (err, comments) => {
            res.json({ comments: comments || [] });
        });
    });
});

app.get('/api/chat/messages', (req, res) => {
    db.all("SELECT * FROM messages ORDER BY id ASC", [], (err, messages) => {
        res.json({ messages: messages || [] });
    });
});

app.post('/api/chat/send', (req, res) => {
    const { sender, message, product_name, product_price, product_image } = req.body;
    db.run(
        "INSERT INTO messages (sender, message, product_name, product_price, product_image) VALUES (?, ?, ?, ?, ?)",
        [sender || 'عميل', message || '', product_name || null, product_price || null, product_image || null],
        function() {
            db.all("SELECT * FROM messages ORDER BY id ASC", [], (err, messages) => {
                res.json({ messages: messages || [] });
            });
        }
    );
});

app.post('/api/chat/clear', auth, (req, res) => {
    db.run("DELETE FROM messages", [], () => {
        res.json({ success: true });
    });
});

// Port & Export Setup for Vercel
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
