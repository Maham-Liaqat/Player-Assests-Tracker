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

// Get all players (sorted by assists descending)
router.get('/', (req, res) => {
  const db = getDatabase();
  
  const sql = `
    SELECT * FROM players 
    ORDER BY assists DESC, name ASC
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

// Get single player by ID
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDatabase();
  
  db.get('SELECT * FROM players WHERE id = ?', [id], (err, row) => {
    db.close(); // Always close the connection
    
    if (err) {
      return res.status(500).json({ 
        error: 'Database error', 
        message: err.message 
      });
    }
    
    if (!row) {
      return res.status(404).json({ 
        error: 'Player not found',
        message: `Player with ID ${id} does not exist.` 
      });
    }
    
    res.json({
      success: true,
      data: row
    });
  });
});

// Update player assists
router.put('/:id/assists', (req, res) => {
  const { id } = req.params;
  const { assists, game_date, opponent, notes } = req.body;
  const db = getDatabase();
  
  if (assists === undefined || assists === null) {
    db.close();
    return res.status(400).json({
      error: 'Missing required field',
      message: 'Assists field is required'
    });
  }
  
  // Start a transaction
  db.serialize(() => {
    // Update player assists
    db.run(
      'UPDATE players SET assists = ? WHERE id = ?',
      [assists, id],
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
            message: `Player with ID ${id} does not exist.` 
          });
        }
        
        // If game info provided, log the assist update
        if (game_date) {
          const assistsAdded = assists - (req.body.previous_assists || 0);
          
          db.run(
            `INSERT INTO assists (player_id, game_date, opponent, assists_added, notes) 
             VALUES (?, ?, ?, ?, ?)`,
            [id, game_date, opponent || null, assistsAdded, notes || null],
            function(err) {
              if (err) {
                console.error('Error logging assist:', err);
              }
              
              // Get updated player data
              db.get('SELECT * FROM players WHERE id = ?', [id], (err, updatedPlayer) => {
                db.close(); // Close connection after final operation
                
                if (err) {
                  return res.status(500).json({ 
                    error: 'Database error', 
                    message: err.message 
                  });
                }
                
                res.json({
                  success: true,
                  message: 'Player assists updated successfully',
                  data: updatedPlayer,
                  assistLogId: this.lastID
                });
              });
            }
          );
        } else {
          // Just return updated player without logging assist
          db.get('SELECT * FROM players WHERE id = ?', [id], (err, updatedPlayer) => {
            db.close(); // Close connection after final operation
            
            if (err) {
              return res.status(500).json({ 
                error: 'Database error', 
                message: err.message 
              });
            }
            
            res.json({
              success: true,
              message: 'Player assists updated successfully',
              data: updatedPlayer
            });
          });
        }
      }
    );
  });
});

// Add assists to player (increment)
router.post('/:id/add-assists', (req, res) => {
  const { id } = req.params;
  const { assists_to_add, game_date, opponent, notes } = req.body;
  const db = getDatabase();
  
  if (assists_to_add === undefined || assists_to_add === null || assists_to_add <= 0) {
    db.close();
    return res.status(400).json({
      error: 'Invalid assists value',
      message: 'assists_to_add must be a positive number'
    });
  }
  
  db.serialize(() => {
    // Get current assists
    db.get('SELECT assists FROM players WHERE id = ?', [id], (err, row) => {
      if (err) {
        db.close();
        return res.status(500).json({ 
          error: 'Database error', 
          message: err.message 
        });
      }
      
      if (!row) {
        db.close();
        return res.status(404).json({ 
          error: 'Player not found',
          message: `Player with ID ${id} does not exist.` 
        });
      }
      
      const newAssists = row.assists + assists_to_add;
      
      // Update player
      db.run(
        'UPDATE players SET assists = ? WHERE id = ?',
        [newAssists, id],
        function(err) {
          if (err) {
            db.close();
            return res.status(500).json({ 
              error: 'Database error', 
              message: err.message 
            });
          }
          
          // Log the assist addition
          db.run(
            `INSERT INTO assists (player_id, game_date, opponent, assists_added, notes) 
             VALUES (?, ?, ?, ?, ?)`,
            [id, game_date || new Date().toISOString().split('T')[0], opponent || null, assists_to_add, notes || null],
            function(err) {
              if (err) {
                console.error('Error logging assist:', err);
              }
              
              // Get updated player
              db.get('SELECT * FROM players WHERE id = ?', [id], (err, updatedPlayer) => {
                db.close(); // Close connection after final operation
                
                if (err) {
                  return res.status(500).json({ 
                    error: 'Database error', 
                    message: err.message 
                  });
                }
                
                res.json({
                  success: true,
                  message: `Successfully added ${assists_to_add} assists to ${updatedPlayer.name}`,
                  data: updatedPlayer,
                  assistLogId: this.lastID
                });
              });
            }
          );
        }
      );
    });
  });
});

// Get Braden Smith specifically
router.get('/braden/smith', (req, res) => {
  const db = getDatabase();
  
  db.get('SELECT * FROM players WHERE is_braden = 1', [], (err, row) => {
    db.close(); // Always close the connection
    
    if (err) {
      return res.status(500).json({ 
        error: 'Database error', 
        message: err.message 
      });
    }
    
    if (!row) {
      return res.status(404).json({ 
        error: 'Player not found',
        message: 'Braden Smith not found in database' 
      });
    }
    
    res.json({
      success: true,
      data: row
    });
  });
});

module.exports = router;