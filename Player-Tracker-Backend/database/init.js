const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'basketball.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite database');
});

// Initial player data
const initialPlayers = [
  { name: 'Bobby Hurley', assists: 1076, team: 'Duke', color: '#001A57', is_braden: 0 },
  { name: 'Chris Corchiani', assists: 1038, team: 'NC State', color: '#CC0000', is_braden: 0 },
  { name: 'Ed Cota', assists: 1030, team: 'North Carolina', color: '#7BAFD4', is_braden: 0 },
  { name: 'Jason Brickman', assists: 1007, team: 'Long Island University', color: '#002D62', is_braden: 0 },
  { name: 'Keith Jennings', assists: 983, team: 'East Tennessee State', color: '#003366', is_braden: 0 },
  { name: 'Steve Blake', assists: 972, team: 'Maryland', color: '#E03A3E', is_braden: 0 },
  { name: 'Sherman Douglas', assists: 960, team: 'Syracuse', color: '#F76900', is_braden: 0 },
  { name: 'Tony Miller', assists: 956, team: 'Marquette', color: '#003366', is_braden: 0 },
  { name: 'Aaron Miles', assists: 954, team: 'Kansas', color: '#0051BA', is_braden: 0 },
  { name: 'Greg Anthony', assists: 950, team: 'Nevada-Las Vegas', color: '#BA0C2F', is_braden: 0 },
  { name: 'Braden Smith', assists: 758, team: 'Purdue', color: '#CEB888', is_braden: 1 }
];

// Initialize database
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create players table
      db.run(`CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        assists INTEGER DEFAULT 0,
        team TEXT NOT NULL,
        color TEXT NOT NULL,
        is_braden INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          reject(err);
          return;
        }
        console.log('✅ Players table created/verified');
      });

      // Create assists table for tracking assist history
      db.run(`CREATE TABLE IF NOT EXISTS assists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER NOT NULL,
        game_date TEXT NOT NULL,
        opponent TEXT,
        assists_added INTEGER NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players (id)
      )`, (err) => {
        if (err) {
          reject(err);
          return;
        }
        console.log('✅ Assists table created/verified');
      });

      // Create games table
      db.run(`CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_date TEXT NOT NULL,
        opponent TEXT NOT NULL,
        location TEXT,
        result TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          reject(err);
          return;
        }
        console.log('✅ Games table created/verified');
      });

      // Create trigger to update updated_at timestamp
      db.run(`CREATE TRIGGER IF NOT EXISTS update_player_timestamp 
              AFTER UPDATE ON players
              FOR EACH ROW
              BEGIN
                UPDATE players SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
              END`, (err) => {
        if (err) {
          console.log('⚠️  Trigger creation warning (may already exist):', err.message);
        } else {
          console.log('✅ Update timestamp trigger created');
        }
      });

      // Check if players table is empty and insert initial data
      db.get("SELECT COUNT(*) as count FROM players", (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (row.count === 0) {
          console.log('Inserting initial player data...');
          
          const stmt = db.prepare(`INSERT INTO players (name, assists, team, color, is_braden) 
                                   VALUES (?, ?, ?, ?, ?)`);
          
          let inserted = 0;
          initialPlayers.forEach(player => {
            stmt.run([player.name, player.assists, player.team, player.color, player.is_braden], function(err) {
              if (err) {
                console.error('Error inserting player:', err);
              } else {
                inserted++;
                console.log(`   ✅ Inserted ${player.name}`);
              }
              
              // When all players are inserted, finalize
              if (inserted === initialPlayers.length) {
                stmt.finalize((err) => {
                  if (err) {
                    console.error('Error finalizing statement:', err);
                  }
                  console.log('✅ All initial player data inserted successfully!');
                  resolve();
                });
              }
            });
          });
        } else {
          console.log('✅ Players table already contains data.');
          resolve();
        }
      });
    });
  });
}

// Run initialization
initializeDatabase()
  .then(() => {
    console.log('🎉 Database initialization completed successfully!');
    console.log('📁 Database file:', dbPath);
    
    // Close database connection
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
        process.exit(1);
      } else {
        console.log('🔒 Database connection closed');
        process.exit(0);
      }
    });
  })
  .catch((err) => {
    console.error('❌ Database initialization failed:', err);
    db.close();
    process.exit(1);
  });