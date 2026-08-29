const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const session = require('express-session');

const app = express();
const db = new sqlite3.Database('./database.db');
const PIN_CODE = '9632580741';

app.use(session({
    secret: 'alamiah-secret-key-2026',
    resave: false,
    saveUninitialized: true
}));

const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname))
});
const upload = multer({ storage });

app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        price REAL,
        description TEXT,
        image TEXT,
        images TEXT
    )`);
    db.run(`ALTER TABLE products ADD COLUMN images TEXT`, () => {});
    db.run(`CREATE TABLE IF NOT EXISTS videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        video_path TEXT,
        likes INTEGER DEFAULT 0
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id INTEGER,
        name TEXT,
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

function requireAuth(req, res, next) {
    if (req.session && req.session.isAdmin) return next();
    res.render('login', { error: null });
}

app.get('/', (req, res) => {
    db.all("SELECT * FROM products", [], (err, products) => {
        db.all("SELECT v.*, (SELECT COUNT(*) FROM comments WHERE video_id = v.id) as comment_count FROM videos v", [], (err, videos) => {
            const formattedProducts = (products || []).map(p => {
                let imgArr = [];
                try { imgArr = p.images ? JSON.parse(p.images) : []; } catch(e) {}
                if (imgArr.length === 0 && p.image) imgArr = [p.image];
                return { ...p, imagesArr: imgArr };
            });
            res.render('index', { products: formattedProducts, videos: videos || [] });
        });
    });
});

app.post('/login', (req, res) => {
    if (req.body.pin === PIN_CODE) {
        req.session.isAdmin = true;
        res.redirect('/admin');
    } else {
        res.render('login', { error: 'رمز الدخول غير صحيح!' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/admin', requireAuth, (req, res) => {
    db.all("SELECT * FROM products", [], (err, products) => {
        db.all("SELECT * FROM videos", [], (err, videos) => {
            const formattedProducts = (products || []).map(p => {
                let imgArr = [];
                try { imgArr = p.images ? JSON.parse(p.images) : []; } catch(e) {}
                if (imgArr.length === 0 && p.image) imgArr = [p.image];
                return { ...p, imagesArr: imgArr };
            });
            res.render('admin', { products: formattedProducts, videos: videos || [] });
        });
    });
});

app.post('/admin/add', requireAuth, upload.array('images', 10), (req, res) => {
    const { name, price, description } = req.body;
    const imagesList = req.files ? req.files.map(f => `/uploads/${f.filename}`) : [];
    const mainImg = imagesList.length > 0 ? imagesList[0] : '';
    const imagesJson = JSON.stringify(imagesList);

    db.run("INSERT INTO products (name, price, description, image, images) VALUES (?, ?, ?, ?, ?)",
        [name, price, description, mainImg, imagesJson], () => res.redirect('/admin'));
});

app.post('/admin/edit/:id', requireAuth, upload.array('images', 10), (req, res) => {
    const { name, price, description } = req.body;
    const id = req.params.id;

    if (req.files && req.files.length > 0) {
        const imagesList = req.files.map(f => `/uploads/${f.filename}`);
        const mainImg = imagesList[0];
        const imagesJson = JSON.stringify(imagesList);
        db.run("UPDATE products SET name=?, price=?, description=?, image=?, images=? WHERE id=?",
            [name, price, description, mainImg, imagesJson, id], () => res.redirect('/admin'));
    } else {
        db.run("UPDATE products SET name=?, price=?, description=? WHERE id=?",
            [name, price, description, id], () => res.redirect('/admin'));
    }
});

app.post('/admin/delete/:id', requireAuth, (req, res) => {
    db.run("DELETE FROM products WHERE id = ?", [req.params.id], () => res.redirect('/admin'));
});

app.post('/admin/video/add', requireAuth, upload.single('video'), (req, res) => {
    const { title } = req.body;
    const video_path = req.file ? `/uploads/${req.file.filename}` : '';
    db.run("INSERT INTO videos (title, video_path, likes) VALUES (?, ?, 0)", [title, video_path], () => res.redirect('/admin'));
});

app.post('/admin/video/edit/:id', requireAuth, upload.single('video'), (req, res) => {
    const { title } = req.body;
    const id = req.params.id;
    if (req.file) {
        const video_path = `/uploads/${req.file.filename}`;
        db.run("UPDATE videos SET title=?, video_path=? WHERE id=?", [title, video_path, id], () => res.redirect('/admin'));
    } else {
        db.run("UPDATE videos SET title=? WHERE id=?", [title, id], () => res.redirect('/admin'));
    }
});

app.post('/admin/video/delete/:id', requireAuth, (req, res) => {
    db.run("DELETE FROM videos WHERE id = ?", [req.params.id], () => res.redirect('/admin'));
});

app.post('/api/video/like/:id', (req, res) => {
    const id = req.params.id;
    db.run("UPDATE videos SET likes = likes + 1 WHERE id = ?", [id], function() {
        db.get("SELECT likes FROM videos WHERE id = ?", [id], (err, row) => {
            res.json({ likes: row ? row.likes : 0 });
        });
    });
});

app.get('/api/video/comments/:id', (req, res) => {
    db.all("SELECT * FROM comments WHERE video_id = ? ORDER BY id DESC", [req.params.id], (err, rows) => {
        res.json({ comments: rows || [] });
    });
});

app.post('/api/video/comment/:id', (req, res) => {
    const id = req.params.id;
    const { name, comment } = req.body;
    if (!comment) return res.status(400).json({ error: 'التعليق فارغ' });
    db.run("INSERT INTO comments (video_id, name, comment) VALUES (?, ?, ?)", [id, name || 'زائر', comment], function() {
        db.all("SELECT * FROM comments WHERE video_id = ? ORDER BY id DESC", [id], (err, rows) => {
            res.json({ comments: rows || [] });
        });
    });
});

app.listen(3000, () => console.log('المتجر يعمل على: http://localhost:3000'));
