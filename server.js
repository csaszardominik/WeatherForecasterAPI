require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql');
const sha1 = require('sha1');

const app = express();
const port = process.env.APP_PORT || 3000;
const pwdRegExp = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const WEATHER_TYPES = ['sunny', 'partly cloudy', 'cloudy', 'rainy', 'stormy', 'snowy', 'foggy', 'windy'];
// HARDCODED sensitive data
var pool = mysql.createPool({
    connectionLimit: process.env.CONN_LIMIT,
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    multipleStatements: process.env.DB_MULTI_QUERY,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    timezone: process.env.DB_TIMEZONE
});

// Middleware
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Log SQL errors
const _query = pool.query.bind(pool);
pool.query = (sql, params, cb) => {
    if (typeof params === 'function') { cb = params; params = []; }
    return _query(sql, params, (err, results) => {
        if (err) console.error('SQL error:', err.code, '-', err.sqlMessage || err.message);
        cb(err, results);
    });
};

// Connection test on startup
pool.getConnection((err, conn) => {
    if (err) return console.error('DB connection error:', err.code, '-', err.message);
    console.log('MySQL connection OK');
    conn.release();
});

// Checks that the logged in user (req.body.luid) is an existing, not banned admin
function requireAdmin(req, res, next) {
    const luid = req.body.luid;

    if (!luid) {
        return res.status(400).json({ error: 'Missing user identifier' });
    }

    pool.query('SELECT role, satus FROM users WHERE ID=?', [luid], (error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Database query error' });
        }

        if (results.length == 0) {
            return res.status(400).json({ error: 'Logged user with this ID doesn\'t exist!' });
        }

        if (results[0].role != 'admin' || results[0].satus == 'Banned') {
            return res.status(403).json({ error: 'You don\'t have permission to do this!' });
        }

        next();
    });
}

// Validates a forecast sent by the admin form. Returns { error } or { values }
function validateForecast(body) {
    const num = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v));
    const date = String(body.date || '').trim();
    const location = String(body.location || '').trim();
    const weatherType = String(body.weather_type || '').trim().toLowerCase();
    const windDirection = String(body.wind_direction || '').trim();

    const tempMin = num(body.temp_min);
    const tempMax = num(body.temp_max);
    const precipitation = num(body.precipitation);
    const probability = num(body.precipitation_probability);
    const windSpeed = num(body.wind_speed);
    const humidity = num(body.humidity);
    const pressure = num(body.pressure);
    const uvIndex = num(body.uv_index);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date).getTime())) {
        return { error: 'Invalid date!' };
    }
    if (!location || location.length > 100) {
        return { error: 'Location is required (max. 100 characters)!' };
    }
    if (!WEATHER_TYPES.includes(weatherType)) {
        return { error: 'Invalid weather type!' };
    }
    if (!windDirection || windDirection.length > 100) {
        return { error: 'Wind direction is required!' };
    }
    if ([tempMin, tempMax, precipitation, probability, windSpeed, humidity, pressure, uvIndex].some(isNaN)) {
        return { error: 'All numeric fields must contain a number!' };
    }
    if (tempMin < -90 || tempMax > 60 || tempMin > tempMax) {
        return { error: 'Temperature values are invalid (min must not be greater than max)!' };
    }
    if (probability < 0 || probability > 100 || humidity < 0 || humidity > 100) {
        return { error: 'Percentages must be between 0 and 100!' };
    }
    if (precipitation < 0 || precipitation > 999 || windSpeed < 0 || windSpeed > 999 || pressure < 0 || pressure > 9999 || uvIndex < 0 || uvIndex > 99) {
        return { error: 'One of the values is out of range!' };
    }

    return {
        values: [date, location, tempMin, tempMax, weatherType, precipitation, Math.round(probability), windSpeed, windDirection, Math.round(humidity), pressure, uvIndex]
    };
}

app.get('/', (req, res) => {
    res.send('Welcome to the WeatherForecaster API!');
});

// USERS ENDPOINTS -------------------

// registration
app.post('/user/register', (req, res) => {
    const { name, email, passwd, confirm } = req.body;

    if (!name || !email || !passwd || !confirm) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (passwd !== confirm) {
        return res.status(400).json({ error: 'Passwords do not match' });
    }

    if (!passwd.match(pwdRegExp)) {
        return res.status(400).json({ error: 'Password is not strong enough' });
    }

    pool.query('SELECT ID FROM users WHERE email = ?', [email], (error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Database query error' });
        }

        if (results.length > 0) {
            return res.status(400).json({ error: 'This e-mail already exists' });
        }

        pool.query('INSERT INTO users (name, email, passwd, role, satus, loginCount) VALUES (?,?,SHA1(?),"user","Allowed",0)', [name, email, passwd], (error) => {
            if (error) {
                return res.status(500).json({ error: 'Database insert error' });
            }

            return res.status(200).json({ message: 'User registered successfully!' });
        });
    });
});

// login
app.post('/user/login', (req, res) => {
    const { email, passwd } = req.body;

    if (!email || !passwd) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    pool.query('SELECT * FROM users WHERE email=? AND passwd = SHA1(?)', [email, passwd], (error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Database query error' });
        }

        if (results.length == 0) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        if (results[0].satus == 'Banned') {
            return res.status(400).json({ error: 'This user is banned by admin!' });
        }

        const loggedUser = {
            ID: results[0].ID,
            name: results[0].name,
            email: results[0].email,
            role: results[0].role
        };

        pool.query('UPDATE users SET last=CURRENT_TIMESTAMP, loginCount=loginCount+1 WHERE ID=?', [results[0].ID], (error) => {
            if (error) {
                return res.status(500).json({ error: 'Database query error' });
            }

            return res.status(200).json({ message: 'You are successfully logged in!', loggedUser });
        });
    });
});

// password change
app.post('/user/:uid/passmod', (req, res) => {
    const { oldpass, newpass, confirm } = req.body;
    const uid = req.params.uid;

    if (!oldpass || !newpass || !confirm) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (newpass != confirm) {
        return res.status(400).json({ error: 'The new password and its confirmation don\'t match!' });
    }

    if (oldpass == newpass) {
        return res.status(400).json({ error: 'The new password equals the old password!' });
    }

    if (!newpass.match(pwdRegExp)) {
        return res.status(400).json({ error: 'The new password is not strong enough!' });
    }

    pool.query('SELECT passwd FROM users WHERE ID=?', [uid], (error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Database query error' });
        }

        if (results.length == 0) {
            return res.status(400).json({ error: 'User with this ID doesn\'t exist!' });
        }

        if (results[0].passwd != sha1(oldpass)) {
            return res.status(400).json({ error: 'The old password is not correct!' });
        }

        pool.query('UPDATE users SET passwd = SHA1(?) WHERE ID=?', [newpass, uid], (error) => {
            if (error) {
                return res.status(500).json({ error: 'Database query error' });
            }

            return res.status(200).json({ message: 'The password was successfully modified!' });
        });
    });
});

// get profile
app.get('/user/:uid', (req, res) => {
    const uid = req.params.uid;

    pool.query('SELECT name, email, role, reg FROM users WHERE ID=?', [uid], (error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Database query error' });
        }

        if (results.length == 0) {
            return res.status(400).json({ error: 'User with this ID doesn\'t exist!' });
        }

        return res.status(200).json({
            results: {
                name: results[0].name,
                email: results[0].email,
                role: results[0].role,
                created_at: results[0].reg
            }
        });
    });
});

// update profile
app.patch('/user/:uid', (req, res) => {
    const uid = req.params.uid;
    const { username, email, loggedUserID } = req.body;

    if (!uid || !username || !email || !loggedUserID) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (uid != loggedUserID) {
        return res.status(400).json({ error: 'You don\'t have permission to update this user!' });
    }

    pool.query('SELECT name, email FROM users WHERE ID=?', [uid], (error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Database query error' });
        }

        if (results.length == 0) {
            return res.status(400).json({ error: 'User with this ID doesn\'t exist!' });
        }

        if (username == results[0].name && email == results[0].email) {
            return res.status(400).json({ error: 'No changes detected!' });
        }

        pool.query('SELECT ID FROM users WHERE email=? AND ID<>?', [email, uid], (error, results2) => {
            if (error) {
                return res.status(500).json({ error: 'Database query error' });
            }

            if (results2.length > 0) {
                return res.status(400).json({ error: 'This e-mail already exists!' });
            }

            pool.query('UPDATE users SET name=?, email=? WHERE ID=?', [username, email, uid], (error) => {
                if (error) {
                    return res.status(500).json({ error: 'Database update error' });
                }

                return res.status(200).json({ message: 'Profile updated successfully!' });
            });
        });
    });
});

// delete by id
app.delete('/user/:uid', (req, res) => {
    const uid = req.params.uid;
    const loggedUserID = req.body.luid;

    if (uid != loggedUserID) {
        return res.status(400).json({ error: 'You don\'t have permission to delete this user!' });
    }

    pool.query('DELETE FROM users WHERE ID=?', [uid], (error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Database query error' });
        }

        if (results.affectedRows == 1) {
            return res.status(200).json({ message: 'User deleted successfully!' });
        }

        return res.status(400).json({ error: 'No deletion occurred!' });
    });
});

// ADMIN ENDPOINTS -------------------

// get all users
app.post('/admin/users', requireAdmin, (req, res) => {
    pool.query('SELECT ID, name, email, role, satus, reg, last, loginCount FROM users', (error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Database query error' });
        }

        return res.status(200).json(results);
    });
});

// ban / allow user (toggle)
app.patch('/admin/status', requireAdmin, (req, res) => {
    const { uid, luid } = req.body;

    if (!uid) {
        return res.status(400).json({ error: 'Missing user identifier' });
    }

    if (uid == luid) {
        return res.status(400).json({ error: 'You can\'t change your own status!' });
    }

    pool.query('SELECT ID FROM users WHERE ID=?', [uid], (error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Database query error' });
        }

        if (results.length == 0) {
            return res.status(400).json({ error: 'User with this ID doesn\'t exist!' });
        }

        pool.query('UPDATE users SET satus = IF(satus = "Banned", "Allowed", "Banned") WHERE ID=?', [uid], (error) => {
            if (error) {
                return res.status(500).json({ error: 'Database update error' });
            }

            return res.status(200).json({ message: 'User status updated successfully!' });
        });
    });
});

// list all forecasts (all columns)
app.post('/admin/weather/list', requireAdmin, (req, res) => {
    pool.query('SELECT * FROM weather_forecasts ORDER BY date DESC, ID DESC', (error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Database query error' });
        }

        return res.status(200).json(results);
    });
});

// add forecast
app.post('/admin/weather', requireAdmin, (req, res) => {
    const { error, values } = validateForecast(req.body);

    if (error) {
        return res.status(400).json({ error });
    }

    pool.query(
        `INSERT INTO weather_forecasts
            (date, location, temp_min, temp_max, weather_type, precipitation, precipitation_probability, wind_speed, wind_direction, humidity, pressure, uv_index)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        values,
        (dbError) => {
            if (dbError) {
                return res.status(500).json({ error: 'Database insert error' });
            }

            return res.status(200).json({ message: 'Forecast added successfully!' });
        }
    );
});

// update forecast
app.patch('/admin/weather/:id', requireAdmin, (req, res) => {
    const { error, values } = validateForecast(req.body);

    if (error) {
        return res.status(400).json({ error });
    }

    pool.query(
        `UPDATE weather_forecasts SET
            date=?, location=?, temp_min=?, temp_max=?, weather_type=?, precipitation=?, precipitation_probability=?,
            wind_speed=?, wind_direction=?, humidity=?, pressure=?, uv_index=?, updated_at=CURRENT_TIMESTAMP
         WHERE ID=?`,
        [...values, req.params.id],
        (dbError, results) => {
            if (dbError) {
                return res.status(500).json({ error: 'Database update error' });
            }

            if (results.affectedRows === 0) {
                return res.status(404).json({ error: 'Forecast cannot be found!' });
            }

            return res.status(200).json({ message: 'Forecast updated successfully!' });
        }
    );
});

// delete forecast
app.delete('/admin/weather/:id', requireAdmin, (req, res) => {
    pool.query('DELETE FROM weather_forecasts WHERE ID = ?', [req.params.id], (error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Database query error' });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ error: 'Forecast cannot be found!' });
        }

        return res.status(200).json({ message: 'Forecast deleted' });
    });
});

// WEATHER -------------------------

// guests: public list, only the allowed fields
app.get('/weather', (req, res) => {
    pool.query('SELECT ID, date, location, temp_min, temp_max, weather_type FROM weather_forecasts ORDER BY date ASC, ID ASC', (error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Database query error' });
        }

        return res.status(200).json(results);
    });
});

// logged in users: detailed data (existing, not banned user only)
app.get('/weather/:id', (req, res) => {
    const uid = req.query.uid;

    if (!uid) {
        return res.status(401).json({ error: 'Log in to see the detailed forecast.' });
    }

    pool.query('SELECT ID, satus FROM users WHERE ID = ?', [uid], (error, users) => {
        if (error) {
            return res.status(500).json({ error: 'Database query error' });
        }

        if (users.length == 0 || users[0].satus == 'Banned') {
            return res.status(403).json({ error: 'You don\'t have permission to see the detailed data.' });
        }

        pool.query('SELECT * FROM weather_forecasts WHERE ID = ?', [req.params.id], (error, rows) => {
            if (error) {
                return res.status(500).json({ error: 'Database query error' });
            }

            if (rows.length == 0) {
                return res.status(404).json({ error: 'Forecast cannot be found!' });
            }

            return res.status(200).json(rows[0]);
        });
    });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
