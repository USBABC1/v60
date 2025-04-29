// Copy.js
// No changes needed for styling, providing complete code as requested.
// Note: This uses CommonJS require and Node's crypto, adjust if your setup differs (e.g., ESM import/export)
const db = require('../lib/db');
const crypto = require('crypto'); // Ensure crypto is imported if using randomUUID

async function list() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM copies ORDER BY created_date DESC', [], (err, rows) => { // Added ordering
      if (err) {
        console.error("Error listing copies:", err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

async function create(data) {
  // Basic validation
  if (!data.title || !data.content || !data.cta || !data.campaign_id) {
      return Promise.reject(new Error("Missing required fields for copy (title, content, cta, campaign_id)"));
  }

  const copyData = {
    id: crypto.randomUUID(),
    title: data.title,
    content: data.content,
    cta: data.cta,
    target_audience: data.target_audience || '',
    status: data.status || 'draft',
    campaign_id: data.campaign_id,
    created_date: new Date().toISOString(),
    clicks: data.clicks || 0,
    impressions: data.impressions || 0,
    conversions: data.conversions || 0
  };

  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO copies (id, title, content, cta, target_audience, status, campaign_id, created_date, clicks, impressions, conversions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [copyData.id, copyData.title, copyData.content, copyData.cta, copyData.target_audience, copyData.status, copyData.campaign_id, copyData.created_date, copyData.clicks, copyData.impressions, copyData.conversions],
      function (err) { // Use standard function for 'this' context if needed, though not used here
        if (err) {
          console.error("Error creating copy:", err);
          reject(err);
        } else {
          console.log(`Copy created with ID: ${copyData.id}`);
          // Optionally, fetch the created row to return it fully populated if needed
          resolve(copyData); // Return the input data + generated ID/date
        }
      }
    );
  });
}

// Added Update and Delete functions (example structure)
async function update(id, data) {
    // Basic validation
    if (!id || !data) {
        return Promise.reject(new Error("Missing ID or data for update"));
    }

    // Build SET clause dynamically (simple example)
    const fields = [];
    const values = [];
    const allowedFields = ['title', 'content', 'cta', 'target_audience', 'status', 'campaign_id', 'clicks', 'impressions', 'conversions'];

    allowedFields.forEach(field => {
        if (data[field] !== undefined) {
            fields.push(`${field} = ?`);
            values.push(data[field]);
        }
    });

    if (fields.length === 0) {
        return Promise.reject(new Error("No valid fields provided for update"));
    }

    values.push(id); // Add id for the WHERE clause

    const sql = `UPDATE copies SET ${fields.join(', ')} WHERE id = ?`;

    return new Promise((resolve, reject) => {
        db.run(sql, values, function(err) {
            if (err) {
                console.error(`Error updating copy ${id}:`, err);
                reject(err);
            } else if (this.changes === 0) {
                reject(new Error(`Copy with ID ${id} not found for update`));
            } else {
                 console.log(`Copy updated with ID: ${id}`);
                resolve({ id, ...data }); // Return updated data (might need re-fetch for accuracy)
            }
        });
    });
}


async function remove(id) {
     if (!id) {
        return Promise.reject(new Error("Missing ID for delete"));
    }
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM copies WHERE id = ?', [id], function(err) {
             if (err) {
                console.error(`Error deleting copy ${id}:`, err);
                reject(err);
            } else if (this.changes === 0) {
                 reject(new Error(`Copy with ID ${id} not found for deletion`));
            }
            else {
                 console.log(`Copy deleted with ID: ${id}`);
                resolve({ id: id, deleted: true });
            }
        });
    });
}


// Ensure all functions are exported
module.exports = { list, create, update, remove }; // Use module.exports for CommonJS