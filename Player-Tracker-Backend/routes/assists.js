const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/basketball.db');

// Database connection helper
function getDatabase() {
  return new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
      console.error('Error connecting to database:', err);
    }
  });
}

// Get all assist logs with player info
router.get('/', (req, res) => {
  const db = getDatabase();
  
  const sql = `
    SELECT a.*, p.name as player_name, p.team as player_team
    FROM assists a
    JOIN players p ON a.player_id = p.id
    ORDER BY a.game_date DESC, a.created_at DESC
  `;
  
  db.all(sql, [], (err, rows) => {
    db.close(); // Always close the connection
    
    if (err) {
      return res.status(500).json({ 
        error: 'Database error', 
        message: err.message 
      });
    }
    
    res.json({
      success: true,
      data: rows,
      count: rows.length
    });
  });
});

// Get assist logs for a specific player
router.get('/player/:playerId', (req, res) => {
  const { playerId } = req.params;
  const db = getDatabase();
  
  const sql = `
    SELECT a.*, p.name as player_name, p.team as player_team
    FROM assists a
    JOIN players p ON a.player_id = p.id
    WHERE a.player_id = ?
    ORDER BY a.game_date DESC, a.created_at DESC
  `;
  
  db.all(sql, [playerId], (err, rows) => {
    db.close(); // Always close the connection
    
    if (err) {
      return res.status(500).json({ 
        error: 'Database error', 
        message: err.message 
      });
    }
    
    res.json({
      success: true,
      data: rows,
      count: rows.length
    });
  });
});

// Get recent assist logs (last 10)
router.get('/recent', (req, res) => {
  const db = getDatabase();
  
  const sql = `
    SELECT a.*, p.name as player_name, p.team as player_team
    FROM assists a
    JOIN players p ON a.player_id = p.id
    ORDER BY a.created_at DESC
    LIMIT 10
  `;
  
  db.all(sql, [], (err, rows) => {
    db.close(); // Always close the connection
    
    if (err) {
      return res.status(500).json({ 
        error: 'Database error', 
        message: err.message 
      });
    }
    
    res.json({
      success: true,
      data: rows,
      count: rows.length
    });
  });
});

// Add new assist log
router.post('/', (req, res) => {
  const { player_id, game_date, opponent, assists_added, notes } = req.body;
  const db = getDatabase();
  
  // Validation
  if (!player_id || !game_date || !assists_added) {
    db.close();
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'player_id, game_date, and assists_added are required'
    });
  }
  
  if (assists_added <= 0) {
    db.close();
    return res.status(400).json({
      error: 'Invalid assists value',
      message: 'assists_added must be a positive number'
    });
  }
  
  db.serialize(() => {
    // First update player's total assists
    db.run(
      'UPDATE players SET assists = assists + ? WHERE id = ?',
      [assists_added, player_id],
      function(err) {
        if (err) {
          db.close();
          return res.status(500).json({ 
            error: 'Database error', 
            message: err.message 
          });
        }
        
        if (this.changes === 0) {
          db.close();
          return res.status(404).json({ 
            error: 'Player not found',
            message: `Player with ID ${player_id} does not exist.` 
          });
        }
        
        // Then log the assist
        db.run(
          `INSERT INTO assists (player_id, game_date, opponent, assists_added, notes) 
           VALUES (?, ?, ?, ?, ?)`,
          [player_id, game_date, opponent || null, assists_added, notes || null],
          function(err) {
            if (err) {
              db.close();
              return res.status(500).json({ 
                error: 'Database error', 
                message: err.message 
              });
            }
            
            const assistLogId = this.lastID;
            
            // Get the newly created assist log with player info
            db.get(`
              SELECT a.*, p.name as player_name, p.team as player_team, p.assists as current_total
              FROM assists a
              JOIN players p ON a.player_id = p.id
              WHERE a.id = ?
            `, [assistLogId], (err, newLog) => {
              db.close(); // Close connection after final operation
              
              if (err) {
                return res.status(500).json({ 
                  error: 'Database error', 
                  message: err.message 
                });
              }
              
              res.status(201).json({
                success: true,
                message: 'Assist log created successfully',
                data: newLog
              });
            });
          }
        );
      }
    );
  });
});

// Delete assist log (undo functionality)
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDatabase();
  
  db.serialize(() => {
    // First get the assist log to know how many assists to subtract
    db.get('SELECT * FROM assists WHERE id = ?', [id], (err, assistLog) => {
      if (err) {
        db.close();
        return res.status(500).json({ 
          error: 'Database error', 
          message: err.message 
        });
      }
      
      if (!assistLog) {
        db.close();
        return res.status(404).json({ 
          error: 'Assist log not found',
          message: `Assist log with ID ${id} does not exist.` 
        });
      }
      
      // Subtract the assists from the player
      db.run(
        'UPDATE players SET assists = assists - ? WHERE id = ?',
        [assistLog.assists_added, assistLog.player_id],
        function(err) {
          if (err) {
            db.close();
            return res.status(500).json({ 
              error: 'Database error', 
              message: err.message 
            });
          }
          
          // Then delete the assist log
          db.run('DELETE FROM assists WHERE id = ?', [id], function(err) {
            db.close(); // Close connection after final operation
            
            if (err) {
              return res.status(500).json({ 
                error: 'Database error', 
                message: err.message 
              });
            }
            
            res.json({
              success: true,
              message: `Assist log deleted and ${assistLog.assists_added} assists subtracted from player`,
              data: {
                deletedLogId: id,
                assistsSubtracted: assistLog.assists_added,
                playerId: assistLog.player_id
              }
            });
          });
        }
      );
    });
  });
});

// Get assist statistics
router.get('/stats/summary', (req, res) => {
  const db = getDatabase();
  
  const sql = `
    SELECT 
      COUNT(*) as total_logs,
      SUM(assists_added) as total_assists_added,
      COUNT(DISTINCT player_id) as unique_players,
      MIN(game_date) as earliest_date,
      MAX(game_date) as latest_date
    FROM assists
  `;
  
  db.get(sql, [], (err, stats) => {
    db.close(); // Always close the connection
    
    if (err) {
      return res.status(500).json({ 
        error: 'Database error', 
        message: err.message 
      });
    }
    
    res.json({
      success: true,
      data: stats
    });
  });
});

module.exports = router;