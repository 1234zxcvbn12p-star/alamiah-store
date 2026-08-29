const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const session = require('express-session');
const app = express();

const db = new sqlite3.Database('./database.db');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.set('view engine', 'ejs');

app.use(session({
    secret: 'alamiah_secret_key',
    resave: false,
    saveUninitialized: true
}));

const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        category TEXT,
        price TEXT,
        description TEXT,
        imagesArr TEXT,
        image TEXT
    )`);

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

    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender TEXT,
        message TEXT,
        product_name TEXT,
        product_price TEXT,
        product_image TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

const auth = (req, res, next) => {
    if (req.session.admin) return next();
    res.redirect('/login');
};

function processProducts(products) {
    return products.map(p => {
        let arr = [];
        if (p.imagesArr) {
            try {
                arr = typeof p.imagesArr === 'string' ? JSON.parse(p.imagesArr) : p.imagesArr;
            } catch (e) {
                arr = [];
            }
        }
        if ((!Array.isArray(arr) || arr.length === 0) && p.image) {
            arr = [p.image];
        }
        return {
            ...p,
            imagesArr: Array.isArray(arr) ? arr : []
        };
    });
}

// دالة تحويل الأرقام العربية إلى إنجليزية وتنظيف المسافات
function normalizePassword(input) {
    if (!input) return '';
    const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    let str = input.toString().trim();
    for (let i = 0; i < 10; i++) {
        str = str.replace(new RegExp(arabicDigits[i], 'g'), i);
    }
    return str;
}

app.get('/', (req, res) => {
    db.all("SELECT * FROM products ORDER BY id DESC", [], (err, products) => {
        products = processProducts(products || []);
        db.all("SELECT * FROM videos ORDER BY id DESC", [], (err, videos) => {
            res.render('index', { products, videos: videos || [] });
        });
    });
});

app.get('/admin', auth, (req, res) => {
    db.all("SELECT * FROM products ORDER BY id DESC", [], (err, products) => {
        products = processProducts(products || []);
        db.all("SELECT * FROM videos ORDER BY id DESC", [], (err, videos) => {
            res.render('admin', { products, videos: videos || [] });
        });
    });
});

app.get('/login', (req, res) => {
    const errorMsg = req.query.error ? '<div style="background:#ef444422;color:#f87171;border:1px solid #ef4444;padding:10px;border-radius:8px;margin-bottom:15px;font-size:13px;text-align:center;">❌ كلمة المرور غير صحيحة، حاول مجدداً</div>' : '';
    
    res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>تسجيل الدخول - العالمية</title>
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, sans-serif; }
            body { background: #0a0a0a; color: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
            .card { background: #171717; border: 1px solid #262626; border-radius: 16px; padding: 30px; width: 100%; max-width: 380px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
            h2 { color: #f59e0b; text-align: center; margin-bottom: 20px; font-size: 22px; font-weight: 800; }
            input { width: 100%; padding: 12px 15px; background: #262626; color: #fff; border: 1px solid #404040; border-radius: 10px; margin-bottom: 15px; font-size: 15px; outline: none; transition: 0.2s; }
            input:focus { border-color: #f59e0b; }
            button { width: 100%; padding: 12px; background: #f59e0b; color: #000; border: none; border-radius: 10px; font-weight: 800; font-size: 15px; cursor: pointer; transition: 0.2s; }
            button:hover { background: #d97706; }
            .back-link { display: block; text-align: center; margin-top: 15px; color: #a3a3a3; text-decoration: none; font-size: 13px; }
            .back-link:hover { color: #fff; }
        </style>
    </head>
    <body>
        <div class="card">
            <h2>لوحة التحكم | العالمية</h2>
            ${errorMsg}
            <form action="/login" method="POST">
                <input type="password" name="password" placeholder="أدخل كلمة المرور..." required autofocus autocomplete="current-password">
                <button type="submit">دخول</button>
            </form>
            <a href="/" class="back-link">← العودة للمتجر</a>
        </div>
    </body>
    </html>
    `);
});

app.post('/login', (req, res) => {
    const enteredPass = normalizePassword(req.body.password);
    const correctPass = '776698022';
    
    if (enteredPass === correctPass) {
        req.session.admin = true;
        res.redirect('/admin');
    } else {
        res.redirect('/login?error=1');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.post('/admin/add', upload.array('images', 10), (req, res) => {
    const { name, category, price, description } = req.body;
    const imgs = req.files && req.files.length > 0 ? req.files.map(f => '/uploads/' + f.filename) : [];
    const imagesArr = JSON.stringify(imgs);
    const mainImg = imgs.length > 0 ? imgs[0] : '';
    db.run("INSERT INTO products (name, category, price, description, imagesArr, image) VALUES (?, ?, ?, ?, ?, ?)",
        [name, category || 'عام', price, description, imagesArr, mainImg],
        () => res.redirect('/admin')
    );
});

app.post('/admin/edit/:id', upload.array('images', 10), (req, res) => {
    const { name, category, price, description } = req.body;
    if (req.files && req.files.length > 0) {
        const imgs = req.files.map(f => '/uploads/' + f.filename);
        const imagesArr = JSON.stringify(imgs);
        const mainImg = imgs[0];
        db.run("UPDATE products SET name=?, category=?, price=?, description=?, imagesArr=?, image=? WHERE id=?",
            [name, category, price, description, imagesArr, mainImg, req.params.id],
            () => res.redirect('/admin')
        );
    } else {
        db.run("UPDATE products SET name=?, category=?, price=?, description=? WHERE id=?",
            [name, category, price, description, req.params.id],
            () => res.redirect('/admin')
        );
    }
});

app.post('/admin/delete/:id', (req, res) => {
    db.run("DELETE FROM products WHERE id=?", [req.params.id], () => res.redirect('/admin'));
});

app.post('/admin/video/add', upload.single('video'), (req, res) => {
    const video_path = req.file ? '/uploads/' + req.file.filename : '';
    db.run("INSERT INTO videos (title, video_path) VALUES (?, ?)", [req.body.title, video_path], () => res.redirect('/admin'));
});

app.post('/admin/video/edit/:id', upload.single('video'), (req, res) => {
    if (req.file) {
        const video_path = '/uploads/' + req.file.filename;
        db.run("UPDATE videos SET title=?, video_path=? WHERE id=?", [req.body.title, video_path, req.params.id], () => res.redirect('/admin'));
    } else {
        db.run("UPDATE videos SET title=? WHERE id=?", [req.body.title, req.params.id], () => res.redirect('/admin'));
    }
});

app.post('/admin/video/delete/:id', (req, res) => {
    db.run("DELETE FROM videos WHERE id=?", [req.params.id], () => res.redirect('/admin'));
});

app.post('/api/video/like/:id', (req, res) => {
    db.run("UPDATE videos SET likes = likes + 1 WHERE id = ?", [req.params.id], function() {
        db.get("SELECT likes FROM videos WHERE id = ?", [req.params.id], (err, row) => {
            res.json({ likes: row ? row.likes : 0 });
        });
    });
});

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

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
