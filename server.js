const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = 5000;
const JWT_SECRET = 'your-secret-key-change-this-in-production';

// Middleware
app.use(cors());
app.use(express.json());

// =============================================
// DATABASE SETUP
// =============================================
const db = new sqlite3.Database('./studentapp.db', (err) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

function initializeDatabase() {
    // Users table
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Students table
    db.run(`
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            course TEXT,
            user_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    // Sessions table (optional - we'll use JWT instead)
    console.log('Database tables initialized');
}

// =============================================
// MIDDLEWARE - Authentication
// =============================================
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// =============================================
// AUTHENTICATION ROUTES
// =============================================

// Register
app.post('/api/register', [
    body('username').notEmpty().withMessage('Username is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
    // Validate
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password } = req.body;

    try {
        // Check if user exists
        const userExists = await new Promise((resolve, reject) => {
            db.get('SELECT email FROM users WHERE email = ?', [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (userExists) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user
        const result = await new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
                [username, email, hashedPassword],
                function(err) {
                    if (err) reject(err);
                    resolve(this.lastID);
                }
            );
        });

        res.status(201).json({ 
            message: 'User registered successfully',
            userId: result 
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error during registration' });
    }
});

// Login
app.post('/api/login', [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
        // Get user
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Get current user
app.get('/api/me', authenticateToken, (req, res) => {
    res.json({
        id: req.user.id,
        username: req.user.username,
        email: req.user.email
    });
});

// =============================================
// STUDENT ROUTES (Protected)
// =============================================

// Get all students for current user
app.get('/api/students', authenticateToken, (req, res) => {
    db.all(
        'SELECT * FROM students WHERE user_id = ? ORDER BY id DESC',
        [req.user.id],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(rows);
        }
    );
});

// Get single student
app.get('/api/students/:id', authenticateToken, (req, res) => {
    db.get(
        'SELECT * FROM students WHERE id = ? AND user_id = ?',
        [req.params.id, req.user.id],
        (err, row) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (!row) {
                return res.status(404).json({ error: 'Student not found' });
            }
            res.json(row);
        }
    );
});

// Create student
app.post('/api/students', authenticateToken, [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, course } = req.body;

    db.run(
        'INSERT INTO students (name, email, course, user_id) VALUES (?, ?, ?, ?)',
        [name, email, course || '', req.user.id],
        function(err) {
            if (err) {
                console.error('Insert error:', err);
                return res.status(500).json({ error: 'Failed to create student' });
            }
            
            // Get the created student
            db.get(
                'SELECT * FROM students WHERE id = ?',
                [this.lastID],
                (err, row) => {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to retrieve created student' });
                    }
                    res.status(201).json(row);
                }
            );
        }
    );
});

// Update student
app.put('/api/students/:id', authenticateToken, [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, course } = req.body;
    const studentId = req.params.id;

    // Check if student exists and belongs to user
    db.get(
        'SELECT * FROM students WHERE id = ? AND user_id = ?',
        [studentId, req.user.id],
        (err, row) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (!row) {
                return res.status(404).json({ error: 'Student not found' });
            }

            // Update student
            db.run(
                'UPDATE students SET name = ?, email = ?, course = ? WHERE id = ? AND user_id = ?',
                [name, email, course || '', studentId, req.user.id],
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to update student' });
                    }
                    
                    // Get updated student
                    db.get(
                        'SELECT * FROM students WHERE id = ?',
                        [studentId],
                        (err, row) => {
                            if (err) {
                                return res.status(500).json({ error: 'Failed to retrieve updated student' });
                            }
                            res.json(row);
                        }
                    );
                }
            );
        }
    );
});

// Delete student
app.delete('/api/students/:id', authenticateToken, (req, res) => {
    const studentId = req.params.id;

    db.run(
        'DELETE FROM students WHERE id = ? AND user_id = ?',
        [studentId, req.user.id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to delete student' });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Student not found' });
            }
            res.json({ message: 'Student deleted successfully' });
        }
    );
});

// Search students
app.get('/api/students/search/:query', authenticateToken, (req, res) => {
    const query = `%${req.params.query}%`;
    
    db.all(
        `SELECT * FROM students 
         WHERE user_id = ? 
         AND (name LIKE ? OR email LIKE ? OR course LIKE ?)
         ORDER BY id DESC`,
        [req.user.id, query, query, query],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(rows);
        }
    );
});

// Get stats
app.get('/api/stats', authenticateToken, (req, res) => {
    db.get(
        'SELECT COUNT(*) as totalStudents FROM students WHERE user_id = ?',
        [req.user.id],
        (err, row) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({
                totalStudents: row.totalStudents || 0,
                userId: req.user.id,
                username: req.user.username
            });
        }
    );
});

// =============================================
// START SERVER
// =============================================
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Database: studentapp.db`);
});