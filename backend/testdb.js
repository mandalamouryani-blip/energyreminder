const pool = require('./db');
(async () => {
  try {
    const [rows] = await pool.query('SELECT DATABASE() AS db, 1+1 AS ok');
    console.log('DB OK:', rows);
  } catch (err) {
    console.error('DB ERROR:', err && err.message ? err.message : err);
  } finally { process.exit(0); }
})();
