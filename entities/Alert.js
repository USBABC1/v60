const db = require('../lib/db');

class Alert {
  static list(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM alerts';
      const params = [];
      if (Object.keys(filters).length) {
        query += ' WHERE ' + Object.keys(filters).map(k => `${k} = ?`).join(' AND ');
        params.push(...Object.values(filters));
      }
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static create(alertData) {
    const defaultData = {
      type: '',
      message: '',
      metric: null,
      value: null,
      threshold: null,
      created_date: new Date().toISOString(),
      read: 0
    };
    const finalData = { ...defaultData, ...alertData };

    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO alerts (type, message, metric, value, threshold, created_date, read) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [finalData.type, finalData.message, finalData.metric, finalData.value, finalData.threshold, finalData.created_date, finalData.read],
        function (err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...finalData });
        }
      );
    });
  }

  static update(entityId, updateData) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE alerts SET read = ? WHERE id = ?',
        [updateData.read, entityId],
        function (err) {
          if (err) reject(err);
          else resolve({ id: entityId, ...updateData });
        }
      );
    });
  }

  static delete(entityId) {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM alerts WHERE id = ?', [entityId], function (err) {
        if (err) reject(err);
        else resolve({ id: entityId });
      });
    });
  }
}

module.exports = { Alert };