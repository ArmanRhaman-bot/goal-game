require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const Task = require('./models/Task');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== MongoDB Connection =====
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// ===== Helper: Generate unique Task ID =====
function generateTaskId() {
  return crypto.randomBytes(8).toString('hex');
}

// ===== API: Create a new task (called by bot/backend) =====
// POST /api/task/create
// body: { userId, totalReward, botToken }
app.post('/api/task/create', async (req, res) => {
  try {
    const { userId, totalReward, botToken } = req.body;

    if (!userId || !totalReward) {
      return res.status(400).json({ success: false, message: 'userId and totalReward are required' });
    }

    const shotsRequired = 7;
    const perShotReward = parseFloat((totalReward / shotsRequired).toFixed(6));

    const taskId = generateTaskId();

    const task = new Task({
      taskId,
      userId,
      botToken: botToken || '',
      totalReward,
      perShotReward,
      shotsRequired,
      status: 'pending'
    });

    await task.save();

    res.json({
      success: true,
      taskId,
      gameUrl: `${req.protocol}://${req.get('host')}/?task=${taskId}`,
      perShotReward,
      totalReward
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ===== API: Get task info (called by frontend on load) =====
app.get('/api/task/:taskId', async (req, res) => {
  try {
    const task = await Task.findOne({ taskId: req.params.taskId });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found or expired' });
    }

    if (task.claimed) {
      return res.json({
        success: true,
        status: 'claimed',
        message: 'This task reward has already been claimed'
      });
    }

    res.json({
      success: true,
      status: task.status,
      shotsRequired: task.shotsRequired,
      shotsTaken: task.shotsTaken,
      goalsScored: task.goalsScored,
      shotResults: task.shotResults,
      perShotReward: task.perShotReward,
      earnedAmount: task.earnedAmount
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ===== API: Take a shot =====
// POST /api/task/:taskId/shot
// body: { direction: 'left' | 'center' | 'right' (top/bottom variants) }
app.post('/api/task/:taskId/shot', async (req, res) => {
  try {
    const task = await Task.findOne({ taskId: req.params.taskId });

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found or expired' });
    }
    if (task.claimed) {
      return res.status(400).json({ success: false, message: 'Already claimed' });
    }
    if (task.shotsTaken >= task.shotsRequired) {
      return res.status(400).json({ success: false, message: 'All shots already taken' });
    }

    const { direction } = req.body;
    const validZones = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'];
    if (!validZones.includes(direction)) {
      return res.status(400).json({ success: false, message: 'Invalid shot direction' });
    }

    // Server-side goalkeeper logic - random zone, weighted slightly toward saving
    // Goalkeeper picks one zone to "cover" - if it matches shot zone exactly, save
    // Add slight save bias for center shots
    const keeperZones = [...validZones];
    let keeperPick = keeperZones[Math.floor(Math.random() * keeperZones.length)];

    // Save probability: ~35% overall chance keeper guesses correctly area
    // We simulate: 65% goal chance baseline, reduced if keeper picks same zone
    let isGoal;
    if (keeperPick === direction) {
      // keeper dives correct way - 70% save chance
      isGoal = Math.random() > 0.70;
    } else {
      // keeper dives wrong way - 88% goal chance
      isGoal = Math.random() > 0.12;
    }

    task.shotsTaken += 1;
    task.shotResults.push(isGoal);
    if (isGoal) {
      task.goalsScored += 1;
      task.earnedAmount = parseFloat((task.earnedAmount + task.perShotReward).toFixed(6));
    }
    task.status = task.shotsTaken >= task.shotsRequired ? 'completed' : 'in_progress';

    await task.save();

    res.json({
      success: true,
      isGoal,
      keeperZone: keeperPick,
      shotsTaken: task.shotsTaken,
      shotsRequired: task.shotsRequired,
      goalsScored: task.goalsScored,
      earnedAmount: task.earnedAmount,
      status: task.status
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ===== API: Claim reward =====
app.post('/api/task/:taskId/claim', async (req, res) => {
  try {
    const task = await Task.findOne({ taskId: req.params.taskId });

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found or expired' });
    }
    if (task.claimed) {
      return res.status(400).json({ success: false, message: 'Already claimed' });
    }
    if (task.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Complete all 7 shots before claiming' });
    }

    task.claimed = true;
    task.claimedAt = new Date();
    task.status = 'claimed';
    await task.save();

    // TODO: Here you can trigger your bot's balance update via Telegram Bot API
    // or call your existing bot's internal API/webhook with task.userId and task.earnedAmount

    res.json({
      success: true,
      message: 'Reward claimed successfully',
      userId: task.userId,
      earnedAmount: task.earnedAmount,
      taskId: task.taskId
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Fallback to index.html for SPA-style routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Wormcup Penalty Shootout server running on port ${PORT}`);
});
