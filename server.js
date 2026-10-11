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

    pool.query('SELECT * FROM user WHERE email = ?', [email], (error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Database query error' });
        }

        if (results.length > 0) {
            return res.status(400).json({ error: 'This e-mail already exists' });
        }

        pool.query('INSERT INTO user (name, email, passwd, role) VALUES (?,?,SHA1(?), "user")', [name, email, passwd], (error, results) => {
            if (error) {
                return res.status(500).json({ error: 'Database query error' });
            }

            return res.status(200).json({ message: 'User registered successfull!' });
        })
    });
})

// login

// logout

// UPDATE PROFILE
// -------------------------

// email/name

// password

// -------------------------

// ADMINS