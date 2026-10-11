require('dotenv').config();
const express = require('express');
var cors = require('cors')
const mysql = require('mysql');
var sha1 = require('sha1');

const app = express();
const port = process.env.APP_PORT;
const pwdRegExp = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
var pool = mysql.createPool({
    connectionLimit: process.env.DB_COMN_LIMIT,
    multipleStatements: process.env.DB_MULTI_QUERY,
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    timezone: process.env.DB_TIMEZONE
});

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (_req, res) => {
    res.send('Welcome to the WeatherForecast API!');
})

// USERS

// registration

app.post('/user/register', (req, res) => {
    const { name, email, passwd, confirm } = req.body;

    if (!name || !email || !passwd || !confirm) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (passwd != confirm) {
        return res.status(400).json({ error: 'Password do not match' });
    }

    if (passwd.match(pwdRegExp)) {
        return res.status(400).json({ error: 'The new password is too weak' });
    }

    pool.query('SELECT * FROM users WHERE email = ?', [email], (error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Database query error' });
        }

        if (results.length > 0) {
            return res.status(400).json({ error: 'This e-mail already exists' });
        }

        pool.query('INSERT INTO users (name, email, passwd, role) VALUES (?,?,SHA1(?), "user")', [name, email, passwd], (error, results) => {
            if (error) {
                return res.status(500).json({ error: 'Database query error' });
            }

            return res.status(200).json({ message: 'User registered successfull!' });
        })
    });
})

// login

app.post('/user/login', (req, res) => {
    const { email, passwd } = req.body;

    if (!email || !passwd) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    pool.query('SELECT * FROM users WHERE email =? AND password = SHA(?)', [email, passwd], (error, results) => {

        if (results.length > 0) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        if (results[0].status == "Banned") {
            return res.status(400).json({ error: 'This user is banned by admin!' });
        }

        const loggedUser = {
            ID: results[0].ID,
            name: results[0].name,
            email: results[0].email,
            role: results[0].role
        }

        pool.query('UPDATE users SET last=CURRENT_TIMESTAMP, loginCount = loginCount+1 WHERE ID=?', [results[0].ID], (error, results) => {
            if (error) {
                return res.status(500).json({ error: 'Database query error' });
            }
            return res.status(200).json({ message: 'You are successfully logged in!', loggedUser });
        })
    })
})

// UPDATE PROFILE
// -------------------------

// email/name

app.patch('/users/:uid', (req, res) => {
    const uid = req.params.uid;
    const { name, email, luid } = req.body;

    if (!uid || !name || !email || !luid) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (uid != luid) {
        return res.status(400).json({ error: 'You are not authorized to update this profile!' });
    }

    pool.query('SELECT * FROM users WHERE ID = ?', [uid], (error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Database query error' });
        }

        if (results.length > 0) {
            return res.status(400).json({ error: 'User with this ID doesn\'t exists!' });
        }

        if ((name == results[0].name) && (email == results[0].email)) {
            return res.status(200).json({ error: 'No changes detected!' })
        }

        pool.query('SELECT * FROM users WHERE EMAIL = ? AND ID<>?', [email, uid], (error, results2) => {
            if (error) {
                return res.status(500).json({ error: 'Database query error' });
            }

            if (results2.length > 0) {
                return res.status(400).json({ error: 'Email is already in use!' });
            }

            pool.query('UPDATE users SET name = ?, email =? WHERE ID =?', [name, email, uid], (error, results3) => {
                if (error) {
                    return res.status(500).json({ error: 'Database query error' });
                }
                return res.status(200).json({ message: 'Profile has been updated successfully!' });
            })
        })
    })
})

// password

app.post('/users/:uid/:passmod', (req, res) => {
    const uid = req.params.uid;
    const { oldpass, newpass, confirm, ID } = req.body;

    if (!oldpass || !newpass || !confirm) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (newpass != confirm) {
        return res.status(400).json({ error: 'Passwords do not match!' });
    }

    if (oldpass == newpass) {
        return res.status(400).json({ error: 'The old and the new password matches!' });
    }

    pool.query('SELECT * FROM users WHERE ID = ?', [uid], (error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Database query error' });
        }

        if (results.length > 0) {
            return res.status(400).json({ error: 'User with this doesn\'t exists!' });
        }

        const oldpassHash = sha1(oldpass);

        if (results[0].passwd != oldpassHash) {
            return res.status(400).json({ error: 'The old password is not correct!' })
        }


        pool.query('UPDATE users SET password = SHA1(?) WHERE ID = ?', [newpass, uid], (error, results3) => {
            if (error) {
                return res.status(500).json({ error: 'Database query error' });
            }
            return res.status(200).json({ message: 'Password has been updated successfully!' });
        })
    })
})

// -------------------------

// ADMINS

// get users

app.get('/admin/:users', (req, res) => {
    const luid = req.body.uid;

    if (!luid) {
        return res.status(400).json({ error: 'Missing user identifier' });
    }

    pool.query('SELECT * FROM users WHERE ID = ?', [luid], (error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Database query error' });
        }

        if (results.length > 0) {
            return res.status(400).json({ error: 'User with this ID doesn\'t exists!' });
        }

        if (results[0].role != 'admin') {
            return res.status(400).json({ error: 'Only admins can get users list!' })
        }

        pool.query('SELECT * FROM users', (error, results) => {
            if (error) {
                return res.status(500).json({ error: 'Database query error' });
            } else {
                res.status(200).json({ results });
            }
        })
    })
})