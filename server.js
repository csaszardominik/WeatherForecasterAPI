require('dotenv').config();
const express = require('express');
var cors = require('cors')
const mysql = require('mysql');
var sha1 = require('sha1');

const app = express();
const port = process.env.APP_PORT;
var pool = mysql.createPool({
    connectionLimit:    process.env.DB_COMN_LIMIT,
    multipleStatements: process.env.DB_MULTI_QUERY,
    host:               process.env.DB_HOST,
    user:               process.env.DB_USER,
    password:           process.env.DB_PASS,
    port:               process.env.DB_PORT,
    database:           process.env.DB_NAME,
    timezone:           process.env.DB_TIMEZONE
});

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (_req, res) => {
    res.send('Welcome to the WeatherForecast API!');
})