const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Serve static files from the public folder
// app.use(express.static('../'));

// Demo data - no database required
let players = [
  { id: 1, name: "Bobby Hurley", assists: 1076, team: "Duke", color: "#001A57", is_braden: 0 },
  { id: 2, name: "Chris Corchiani", assists: 1038, team: "NC State", color: "#CC0000", is_braden: 0 },
  { id: 3, name: "Ed Cota", assists: 1030, team: "North Carolina", color: "#7BAFD4", is_braden: 0 },
  { id: 4, name: "Jason Brickman", assists: 1007, team: "Long Island University", color: "#002D62", is_braden: 0 },
  { id: 5, name: "Keith Jennings", assists: 983, team: "East Tennessee State", color: "#003366", is_braden: 0 },
  { id: 6, name: "Steve Blake", assists: 972, team: "Maryland", color: "#E03A3E", is_braden: 0 },
  { id: 7, name: "Sherman Douglas", assists: 960, team: "Syracuse", color: "#F76900", is_braden: 0 },
  { id: 8, name: "Tony Miller", assists: 956, team: "Marquette", color: "#003366", is_braden: 0 },
  { id: 9, name: "Aaron Miles", assists: 954, team: "Kansas", color: "#0051BA", is_braden: 0 },
  { id: 10, name: "Greg Anthony", assists: 950, team: "Nevada-Las Vegas", color: "#BA0C2F", is_braden: 0 },
  { id: 11, name: "Braden Smith", assists: 758, team: "Purdue", color: "#CEB888", is_braden: 1 }
];

// Store assist history for undo functionality
let assistHistory = [];

// API Routes
app.get('/api/players', (req, res) => {
  const sortedPlayers = [...players].sort((a, b) => b.assists - a.assists);
  res.json({
    success: true,
    data: sortedPlayers,
    count: sortedPlayers.length
  });
});

app.post('/api/players/:id/add-assists', (req, res) => {
  const { id } = req.params;
  const { assists_to_add } = req.body;
  
  const player = players.find(p => p.id == id);
  if (!player) {
    return res.status(404).json({ 
      error: 'Player not found',
      message: `Player with ID ${id} does not exist.` 
    });
  }
  
  if (!assists_to_add || assists_to_add < 1) {
    return res.status(400).json({
      error: 'Invalid assists value',
      message: 'assists_to_add must be a positive number'
    });
  }
  
  // Store previous state for undo
  assistHistory.push({
    playerId: player.id,
    previousAssists: player.assists,
    assistsAdded: assists_to_add,
    timestamp: new Date().toISOString()
  });
  
  // Update player assists
  player.assists += assists_to_add;
  
  res.json({
    success: true,
    message: `Successfully added ${assists_to_add} assists to ${player.name}`,
    data: player,
    assistLogId: assistHistory.length // Simple ID based on array length
  });
});

// Reduce player assists (IN-MEMORY VERSION)
app.post('/api/players/:id/reduce-assists', (req, res) => {
  const { id } = req.params;
  const { assists_to_remove } = req.body;
  
  const player = players.find(p => p.id == id);
  if (!player) {
    return res.status(404).json({ 
      error: 'Player not found',
      message: `Player with ID ${id} does not exist.` 
    });
  }
  
  if (!assists_to_remove || assists_to_remove < 1) {
    return res.status(400).json({
      error: 'Invalid assists value',
      message: 'assists_to_remove must be a positive number'
    });
  }
  
  // Check if reduction would result in negative assists
  if (player.assists - assists_to_remove < 0) {
    return res.status(400).json({
      error: 'Invalid operation',
      message: `Cannot remove ${assists_to_remove} assists. Player only has ${player.assists} assists.`
    });
  }
  
  // Store previous state for undo
  assistHistory.push({
    playerId: player.id,
    previousAssists: player.assists,
    assistsAdded: -assists_to_remove, // Negative for reduction
    timestamp: new Date().toISOString()
  });
  
  // Update player assists
  player.assists -= assists_to_remove;
  
  res.json({
    success: true,
    message: `Successfully removed ${assists_to_remove} assists from ${player.name}`,
    data: player,
    assistLogId: assistHistory.length // Simple ID based on array length
  });
});

app.delete('/api/assists/:id', (req, res) => {
  const { id } = req.params;
  const logIndex = parseInt(id) - 1;
  
  if (logIndex < 0 || logIndex >= assistHistory.length) {
    return res.status(404).json({ 
      error: 'Assist log not found',
      message: `Assist log with ID ${id} does not exist.` 
    });
  }
  
  const log = assistHistory[logIndex];
  const player = players.find(p => p.id == log.playerId);
  
  if (player) {
    // Subtract the previously added assists (works for both positive and negative)
    player.assists -= log.assistsAdded;
  }
  
  // Remove from history
  assistHistory.splice(logIndex, 1);
  
  res.json({
    success: true,
    message: `Successfully undone ${Math.abs(log.assistsAdded)} assists`,
    data: {
      deletedLogId: id,
      assistsSubtracted: log.assistsAdded,
      playerId: log.playerId
    }
  });
});

app.get('/api/assists/recent', (req, res) => {
  const recent = assistHistory.length > 0 ? assistHistory[assistHistory.length - 1] : null;
  res.json({
    success: true,
    data: recent
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Basketball Assist Tracker API is running',
    timestamp: new Date().toISOString()
  });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Basketball Assist Tracker running on http://localhost:${PORT}`);
  console.log(`📊 API: http://localhost:${PORT}/api/players`);
  console.log(`🌐 Frontend: http://localhost:${PORT}`);
  console.log(`❤️  Health: http://localhost:${PORT}/api/health`);
  console.log(`➕ Add Assists: POST http://localhost:${PORT}/api/players/11/add-assists`);
  console.log(`➖ Reduce Assists: POST http://localhost:${PORT}/api/players/11/reduce-assists`);
});