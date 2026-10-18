require('dotenv').config();
const express = require('express');
var cors = require('cors')
const mysql = require('mysql');
var sha1 = require('sha1');

const app = express();
const port = process.env.APP_PORT 
const pwdRegExp = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

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
//Middlewareeeadddadasd
app.use(cors())
app.use(express.urlencoded({extended: true}))
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Welcome to the StepCounter API!')
})

const _query = pool.query.bind(pool);
pool.query = (sql, params, cb) => {
    if (typeof params === 'function') { cb = params; params = []; }
    return _query(sql, params, (err, results) => {
        if (err) console.error('SQL hiba:', err.code, '-', err.sqlMessage || err.message);
        cb(err, results);
    });
};

// induláskor kapcsolat-teszt
pool.getConnection((err, conn) => {
    if (err) return console.error('DB kapcsolódási hiba:', err.code, '-', err.message);
    console.log('MySQL kapcsolat OK');
    conn.release();
});

// USERS ENDPOINTS -------------------

// registration

app.post('/user/register', (req, res) => {
    const {name, email, passwd, confirm} = req.body;

    if(!name || !email || !passwd || !confirm){
        return res.status(400).json({error: 'Missing required fields'});
    }   

    if(passwd !== confirm){
        return res.status(400).json({error: 'Password do not match'});
    }

    //TODO: check password strength (with regular expenssion)
    if (!passwd.match(pwdRegExp)){
        return res.status(400).json({error: 'Password is not strong enough'});
    }
       

    pool.query('SELECT * FROM users WHERE email = ?', [email], (error, results) => {
        if (error){
            return res.status(500).json({error: 'Database query error'});
        }

        if(results.length > 0){
            return res.status(400).json({error: 'This e-mail already exists '})
        }

        pool.query('INSERT INTO users (name, email, passwd, role) VALUES (?,?,SHA1(?), "user")', [name, email, passwd], (error, results) => {
            if(error){
                return res.status(500).json({error: 'Database insert error'});
            }


           return res.status(200).json({ message: 'User registered successfully!'});
        });
        
    });
});

// login

app.post('/user/login', (req,res) => {
    const {email, passwd} = req.body;

    // VALIDATION

    // Check for missing fields
    if(!email || !passwd){
        return res.status(400).json({error: 'Missing required fields'});
    }

    // check email and password exists
    pool.query('SELECT * FROM users WHERE email=? AND passwd = SHA1(?)', [email, passwd], (error, results) => {
        if(error){
            return res.status(500).json({error: 'Database query error'});
        }
        
        // if don't exists user with this email and password
        if(results.length == 0){
            return res.status(400).json({error:'Invalid credentials'});
        }

        if(results[0].is_active == 0){
            return res.status(400).json({error: 'This user is banned by admin!'})
        }

        //TODO: check user is_active?   
        const loggedUser = {
            ID: results[0].ID,
            name: results[0].name,
            email: results[0].email,
            role: results[0].role
        };
        pool.query('UPDATE users SET last=CURRENT_TIMESTAMP, loginCount=loginCount+1  WHERE ID=?', [results[0].ID], (error, results) => {
            if(error){
                return res.status(500).json({error: 'Database query error'})
            }   
            //TODO: send logged user data to frontend
            return res.status(200).json({message: 'You are successfully logged in!', loggedUser})
        })
    });
});

// logout

// password change

app.post('/user/:uid/passmod', (req, res) => {
    const {oldpass, newpass, confirm, userID} = req.body; // Átvesszük a frontendtől érkező adatokat
    const uid = req.params.uid; // Kiolvassuk az url-ből a userID-t

    // megnézzük hogy minden kötelezőt megadott-e
    if (!oldpass || !newpass || !confirm){
        return res.status(400).json({error: 'Missing required fields'});
    }

    // megnezzuk hogy az uj megegyezik e
    if (newpass != confirm){
        return res.status(400).json({error: 'The new password and it\'s confirm doesn\'t match!'});
    }

    
    if(oldpass == newpass){
        return res.status(400).json({error: 'The new password equals with old password!'});
    }

    //TODO: newpassword strenght check with regular expression

    if (!newpass.match(pwdRegExp)){
        return res.status(400).json({error: 'The new password is not strong enough!'});
    }

        pool.query('SELECT * FROM users WHERE ID=?',[uid], (error, results) => {
        if(error){
            return res.status(500).json({error: 'Database query error'});
        }

        if(results.length == 0){
            return res.status(400).json({error: 'User with this doesn\'t exist!'});
        }

        // hash-eljuk a megadott jelenlegi jelszot, hogy ossze tudjuk hasonlitani az adatbazisban levovel
        const oldpassHash = sha1(oldpass);

        console.log(oldpassHash);

        if (results[0].passwd != oldpassHash){
            return res.status(400).json({error: 'The old password in not correct!'});
        }

        // Update password
        pool.query('UPDATE users SET passwd = SHA1(?) WHERE ID=?', [newpass, uid], (error,results) => {
            if(error){
                return res.status(500).json({error: 'Database query error'});
            }

            return res.status(200).json({message: 'The password successfully modified!'})
        });
    });
});

// get profile 

app.get('/user/:uid', (req, res) => {
    const uid = req.params.uid;

    if (!uid){
        return res.status(400).json({error: 'Missing user identifier'})         
    }

    pool.query('SELECT * FROM users WHERE ID=?', [uid], (error, results) => {
        if(error){
            return res.status(500).json({error: 'Database query error'})
        }

        if(results.length == 0){
            return res.status(400).json({error: 'User with this ID doesn\'t exits!'});
        }

        let user ={
            "name": results[0].name,
            "email": results[0].email,
            "role": results[0].role,
            "created_at": results[0].created_at
        }
        
        return res.status(200).json({results: user});
        
    });
});

// update profile
app.patch('/user/:uid', (req, res) => {
    const uid = req.params.uid;
    const {username, email, loggedUserID} = req.body;

    if(!uid || !username || !email || !loggedUserID){
        return res.status(400).json({error: 'Missing required fields'});
    }
    if(uid != loggedUserID){
        return res.status(400).json({error: 'You don\'t have permission to update this user!'});
    }
    pool.query('SELECT * FROM users WHERE ID=?', [uid], (error, results) => {
        if(error){
            return res.status(500).json({error: 'Database query error'});
        }
        if(results.length == 0){
            return res.status(400).json({error: 'User with this ID doesn\'t exist!'});
        }
        if(username == results[0].name && email == results[0].email){
            return res.status(200).json({error: 'No changes detected!'});
        }
        pool.query('SELECT * FROM users WHERE email=? AND ID<>?', [email, uid], (error, results2) => {
            if(error){
                return res.status(500).json({error: 'Database query error'});
            }
            if(results2.length > 0){
                return res.status(400).json({error: 'This e-mail already exists!'});
            }

            pool.query('UPDATE users SET name=?, email=? WHERE ID=?', [username, email, uid], (error) => {
                if(error){
                    return res.status(500).json({error: 'Database update error'});
                }

                return res.status(200).json({message: 'Profile updated successfully!'});
            });
        });
    });
});

app.delete('/user/:uid', (req, res) => {
    const uid = req.params.uid;
    const loggedUserID = req.body.luid;

    if(!uid){
        return res.status(400).json({error: 'Missing user identifier'});
    }

    if(uid != loggedUserID){
        return res.status(400).json({error: 'You don\'t have permission to delete this user!'});
    }

    pool.query('DELETE FROM users WHERE ID=?', [uid], (error, results) => {
        if(error){
            return res.status(500).json({error: 'Database query error'});
        }

        if(results.affectedRows == 1){
            return res.status(200).json({error: 'User deleted successfully!'})
        }
        
        return res.status(200).json({message: 'No deletion occured!'});

    });
});

// -------------------------

// ADMINS

// get all users

app.post('/admin/users', (req, res) => {
    const { luid } = req.body;

    pool.query('SELECT * FROM users WHERE ID=?', [luid], (error, results) => {
        if(error){
            console.log(error); // ezt is érdemes ideiglenesen hozzáadni
            return res.status(500).json({error: 'Database query error'});
        }

        if(results.length == 0){
            return res.status(400).json({
                error: 'Logged user with this ID doesn\'t exist!'
            });
        }

        if(results[0].role != 'admin'){
            return res.status(400).json({
                error: 'You don\'t have permission to view all users!'
            });
        }

        pool.query('SELECT * FROM users', (error, results) => {
            if(error){
                console.log(error);
                return res.status(500).json({
                    error: 'Database query error'
                });
            }

            return res.status(200).json(results);
        });
    });
});
// deny user
app.patch('/admin/status', (req, res) => {
    const { uid, luid} = req.body;
    if(!uid || !luid){
        return res.status(400).json({error: 'Missing user identifier'});
    }
    pool.query('SELECT * FROM users WHERE ID=?', [luid], (error, results) => {
        if(error){
            return res.status(500).json({error: 'Database query error'});
        }
        if(results.length == 0){
            return res.status(400).json({error: 'Logged user with this ID doesn\'t exist!'});
        }
       
        if(results[0].role != 'admin'){
            return res.status(400).json({error: 'You don\'t have permission to update user status!'});
        }
    pool.query('SELECT * FROM users WHERE ID=?', [uid], (error, results) => {
        if(error){
            return res.status(500).json({error: 'Database query error'});
        }
        if(results.length == 0){
            return res.status(400).json({error: 'User with this ID doesn\'t exist!'});
        }
      
        pool.query('UPDATE users SET is_active=not is_active WHERE ID=?', [uid], (error, results) => {
            if(error){
                return res.status(500).json({error: 'Database update error'});
            }
            return res.status(200).json({message: 'User status updated successfully!'});
        });
        
    });
    });
});

// forecaster for admin
app.get('/admin/weather', (req, res) => {
    pool.query('SELECT * FROM weather_forecasts ORDER BY date DESC', (error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Database query error' });
        }

        return res.status(200).json(results);
    })
})

// forecast delete

app.delete('/admin/weather/:id', (req, res) => {
    const uid = req.params.uid;

    pool.query('DELETE FROM weather_forecasts WHERE ID = ?', [uid], ( error, results) => {
        if (error) {
            return res.status(500).json({ error: 'Database query error' });
        }

        if(results.affectedRows === 0){
            return res.status(404).json({error: 'Forecast cannot be found!'});
        }

        return res.status(200).json({message: 'Forecast deleted'});
    })
})

// WEATHER
// -------------------------

// weather forecasts
// app.get('/weather', (req, res) => {
//     pool.query('SELECT ID, date, location, temp_min, temp_max, weather_type FROM weather_forecasts ORDER BY date ASC', (error, results) => {
//         if (error) {
//             return res.status(500).json({ error: 'Database query error' });
//         }

//         return res.status(200).json(results);
//     })
// })

// app.get('/weather', (_req, res) => {
//     pool.query('SELECT ID, date, location, temp_min, temp_max, weather_type FROM weather_forecasts ORDER BY date ASC', (error, rows) => {
//         if (error) return res.status(500).json({ error: 'Database query error' });
//         res.json(rows);
//     });
// });

// app.get('/weather', (req, res) => {
//     pool.query(
//         'SELECT * FROM weather_forecasts ORDER BY date DESC',
//         (error, results) => {
//             if (error) {
//                 console.error('Adatbázis-hiba:', error);
//                 return res.status(500).json({
//                     error: 'Nem sikerült lekérni az időjárási adatokat.'
//                 });
//             }

//             res.status(200).json(results);
//         }
//     );
// });

// ---- VENDÉG: nyilvános lista, csak a megengedett mezők ----
app.get('/weather', (_req, res) => {
    pool.query('SELECT ID, date, location, temp_min, temp_max, weather_type FROM weather_forecasts ORDER BY date ASC', (error, rows) => {
        if (error) return res.status(500).json({ error: 'Database query error' });
        res.json(rows);
    });
});
 
// ---- FELHASZNÁLÓ: részletes adatok, csak létező, nem kitiltott usernek ----
app.get('/weather/:id', (req, res) => {
    const uid = req.query.uid;
    if (!uid) return res.status(401).json({ error: 'Jelentkezz be a részletes előrejelzés megtekintéséhez.' });
    query('SELECT ID, status FROM users WHERE ID = ?', [uid], res, users => {
        if (!users.length || users[0].status === 'banned') return res.status(403).json({ error: 'Nincs jogosultságod a részletes adatok megtekintéséhez.' });
        query('SELECT * FROM weather_forecasts WHERE ID = ?', [req.params.id], res, rows => {
            if (!rows.length) return res.status(404).json({ error: 'Forecast cannot be found!' });
            res.json(rows[0]);
        });
    });
});


// weather forecasts for users

// app.get('/weather/:id', (req, res) => {
//     const uid = req.params.uid;

//     if(!uid){
//         return res.status(401).json({error: 'Login in to check the weather forecasts'});
//     }

//     pool.query('SELECT ID, status, FROM users WHERE ID = ?', [uid], (error, results) => {
//         if (error) {
//             return res.status(500).json({ error: 'Database query error' });
//         }

//         if (results.length > 0 || results[0].status !== 'Allowed') {
//             return res.status(400).json({ error: 'You cannot see this' });
//         }

//         pool.query('SELECT * FROM weather_forecasts WHERE ID = ?', [uid], (error2, results2) => {
//             if (error2) {
//                 return res.status(500).json({ error: 'Database query error' });
//             }

//             if (results2.length > 0) {
//                 return res.status(400).json({ error: 'Forecaster cannot be found' });
//             }

//             return res.status(200).json(results2[0])
//         })
//     });
// })

// Új előrejelzés hozzáadása
app.post('/admin/weather', (req, res) => {
    const d = req.body;

    if (
        !d.date ||
        !d.location ||
        d.temp_min === undefined ||
        d.temp_min === '' ||
        d.temp_max === undefined ||
        d.temp_max === '' ||
        !d.weather_type
    ) {
        return res.status(400).json({
            error: 'A dátum, hely, minimum, maximum és időjárástípus kötelező.'
        });
    }

    const sql = `
        INSERT INTO weather_forecasts
        (
            date, location, temp_min, temp_max, weather_type,
            precipitation, precipitation_probability, wind_speed,
            wind_direction, humidity, pressure, uv_index,
            created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const values = [
        d.date,
        d.location,
        d.temp_min,
        d.temp_max,
        d.weather_type,
        d.precipitation || 0,
        d.precipitation_probability || 0,
        d.wind_speed || 0,
        d.wind_direction || 'N',
        d.humidity || 0,
        d.pressure || 1013,
        d.uv_index || 0
    ];

    pool.query(sql, values, (error) => {
        if (error) {
            return res.status(500).json({
                error: 'Nem sikerült menteni az előrejelzést.'
            });
        }

        return res.status(200).json({
            message: 'Az előrejelzés hozzáadva.'
        });
    });
});

// Előrejelzés módosítása
app.put('/admin/weather/:id', (req, res) => {
    const d = req.body;

    if (
        !d.date ||
        !d.location ||
        d.temp_min === undefined ||
        d.temp_min === '' ||
        d.temp_max === undefined ||
        d.temp_max === '' ||
        !d.weather_type
    ) {
        return res.status(400).json({
            error: 'A dátum, hely, minimum, maximum és időjárástípus kötelező.'
        });
    }

    const sql = `
        UPDATE weather_forecasts
        SET date = ?, location = ?, temp_min = ?, temp_max = ?,
            weather_type = ?, precipitation = ?,
            precipitation_probability = ?, wind_speed = ?,
            wind_direction = ?, humidity = ?, pressure = ?,
            uv_index = ?, updated_at = NOW()
        WHERE ID = ?
    `;

    const values = [
        d.date,
        d.location,
        d.temp_min,
        d.temp_max,
        d.weather_type,
        d.precipitation || 0,
        d.precipitation_probability || 0,
        d.wind_speed || 0,
        d.wind_direction || 'N',
        d.humidity || 0,
        d.pressure || 1013,
        d.uv_index || 0,
        req.params.id
    ];

    pool.query(sql, values, (error, results) => {
        if (error) {
            return res.status(500).json({
                error: 'Nem sikerült módosítani az előrejelzést.'
            });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({
                error: 'Az előrejelzés nem található.'
            });
        }

        return res.status(200).json({
            message: 'Az előrejelzés módosítva.'
        });
    });
});

// Előrejelzés törlése
app.delete('/admin/weather/:id', (req, res) => {
    pool.query(
        'DELETE FROM weather_forecasts WHERE ID = ?',
        [req.params.id],
        (error, results) => {
            if (error) {
                return res.status(500).json({
                    error: 'Nem sikerült törölni az előrejelzést.'
                });
            }

            if (results.affectedRows === 0) {
                return res.status(404).json({
                    error: 'Az előrejelzés nem található.'
                });
            }

            return res.status(200).json({
                message: 'Az előrejelzés törölve.'
            });
        }
    );
});
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);

})