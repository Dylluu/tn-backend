const express = require('express');
const cors = require('cors');
const mysql = require('mysql');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT;

const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL: ' + err.stack);
        return;
    }
});

process.on('SIGINT', () => {
    connection.end();
    process.exit();
});

app.use(cors());

app.get('/api/plot', (req, res) => {
    try {
        connection.query(`SELECT phase, count(phase) FROM new_schema.patents GROUP by phase`, (error, results) => {
            if (error || !results.length) {
                throw error ?? new Error('No results returned');
            }

            const formattedData = [];

            for (let i = 0; i < results.length; i++) {
                formattedData.push({
                    name: results[i].phase,
                    count: results[i]['count(phase)']
                });
            }

            res.json(formattedData);
        });
    } catch (e) {
        console.error('Error fetching plot data:', e);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/api/', (req, res) => {
    try {
        const keyword = req.query.query || '';
        const limit = 10;
        const offset = parseInt(((req.query.page - 1) * limit), 10) || 0;

        connection.query(
            'SELECT COUNT(*) AS total_count FROM new_schema.patents WHERE LOWER(patent_text) LIKE LOWER(?)',
            [`%${keyword}%`],
            (error, count) => {
                if (error) {
                    throw error;
                }

                const totalCount = count[0].total_count;

                connection.query(
                    'SELECT *, DATE_FORMAT(Date, "%Y-%m-%d") AS Date FROM new_schema.patents WHERE LOWER(patent_text) LIKE LOWER(?) LIMIT ? OFFSET ?',
                    [`%${keyword}%`, limit, offset],
                    (error, results) => {
                        if (error) {
                            throw error;
                        }

                        if (results.length === 0) {
                            return res.status(404).json({
                                total_count: 0,
                                query_results: [{ Error: `No results found for ${keyword}`}]
                            });
                        }

                        res.json({
                            total_count: totalCount,
                            query_results: results,
                        });
                    }
                );
            }
        );
    } catch (e) {
        console.error('Error fetching patents:', e);
        res.status(500).send('Internal Server Error');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
