const express = require('express');
const bcrypt = require('bcrypt');
const session = require('express-session');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session configuration
app.use(session({
  secret: 'sriramik-eduportal-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Helper functions for JSON file operations with error handling
async function readJSONFile(filename) {
  try {
    const data = await fs.readFile(filename, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`Creating new ${filename} file`);
      return [];
    }
    console.error(`Error reading ${filename}:`, error.message);
    return [];
  }
}

async function writeJSONFile(filename, data) {
  try {
    await fs.writeFile(filename, JSON.stringify(data, null, 2));
    console.log(`Successfully wrote to ${filename}`);
  } catch (error) {
    console.error(`Error writing to ${filename}:`, error.message);
    throw error;
  }
}

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
}

// Helper function to extract video ID from YouTube URL
function extractYouTubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
  return match ? match[1] : null;
}

// Helper function to extract Google Drive file ID
function extractDriveId(url) {
  if (!url) return null;
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

// API Routes

// Signup
app.post('/api/signup', async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!['student', 'teacher'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: Date.now().toString(),
      username,
      email,
      password: hashedPassword,
      role,
      createdAt: new Date().toISOString()
    };

    if (role === 'teacher') {
      const teachers = await readJSONFile('teach.json');
      
      if (teachers.find(t => t.email === email)) {
        return res.status(400).json({ error: 'Teacher with this email already exists' });
      }
      
      newUser.content = [];
      teachers.push(newUser);
      await writeJSONFile('teach.json', teachers);
    } else {
      const students = await readJSONFile('student.json');
      
      if (students.find(s => s.email === email)) {
        return res.status(400).json({ error: 'Student with this email already exists' });
      }
      
      newUser.joinedTeachers = [];
      students.push(newUser);
      await writeJSONFile('student.json', students);
    }

    req.session.user = { id: newUser.id, username, email, role };
    res.json({ message: 'Account created successfully', user: req.session.user });
    console.log(`New ${role} registered: ${username}`);
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    let users;
    if (role === 'teacher') {
      users = await readJSONFile('teach.json');
    } else {
      users = await readJSONFile('student.json');
    }

    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.user = { id: user.id, username: user.username, email: user.email, role: user.role };
    res.json({ message: 'Login successful', user: req.session.user });
    console.log(`User logged in: ${user.username} (${role})`);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  const username = req.session?.user?.username || 'Unknown';
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Could not log out' });
    }
    console.log(`User logged out: ${username}`);
    res.json({ message: 'Logged out successfully' });
  });
});

// Get current user
app.get('/api/user', requireAuth, (req, res) => {
  res.json({ user: req.session.user });
});

// Teacher content upload
app.post('/api/teacher/content', requireAuth, async (req, res) => {
  try {
    if (req.session.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { title, subject, youtubeLink, driveLink } = req.body;

    if (!title || !subject) {
      return res.status(400).json({ error: 'Title and subject are required' });
    }

    if (!youtubeLink && !driveLink) {
      return res.status(400).json({ error: 'At least one link (YouTube or Drive) is required' });
    }

    const teachers = await readJSONFile('teach.json');
    const teacherIndex = teachers.findIndex(t => t.id === req.session.user.id);

    if (teacherIndex === -1) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const newContent = {
      id: Date.now().toString(),
      title,
      subject,
      youtubeLink: youtubeLink || null,
      youtubeId: extractYouTubeId(youtubeLink),
      driveLink: driveLink || null,
      driveId: extractDriveId(driveLink),
      createdAt: new Date().toISOString()
    };

    teachers[teacherIndex].content.push(newContent);
    await writeJSONFile('teach.json', teachers);

    res.json({ message: 'Content uploaded successfully', content: newContent });
    console.log(`Content uploaded by ${req.session.user.username}: ${title}`);
  } catch (error) {
    console.error('Content upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get teacher's content
app.get('/api/teacher/content', requireAuth, async (req, res) => {
  try {
    if (req.session.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const teachers = await readJSONFile('teach.json');
    const teacher = teachers.find(t => t.id === req.session.user.id);

    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    res.json({ content: teacher.content || [] });
  } catch (error) {
    console.error('Get teacher content error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete teacher content
app.delete('/api/teacher/content/:contentId', requireAuth, async (req, res) => {
  try {
    if (req.session.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { contentId } = req.params;
    const teachers = await readJSONFile('teach.json');
    const teacherIndex = teachers.findIndex(t => t.id === req.session.user.id);

    if (teacherIndex === -1) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const contentIndex = teachers[teacherIndex].content.findIndex(c => c.id === contentId);
    if (contentIndex === -1) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const deletedContent = teachers[teacherIndex].content[contentIndex];
    teachers[teacherIndex].content.splice(contentIndex, 1);
    await writeJSONFile('teach.json', teachers);

    res.json({ message: 'Content deleted successfully' });
    console.log(`Content deleted by ${req.session.user.username}: ${deletedContent.title}`);
  } catch (error) {
    console.error('Delete content error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all teachers and their content for students
app.get('/api/teachers', requireAuth, async (req, res) => {
  try {
    if (req.session.user.role !== 'student') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const teachers = await readJSONFile('teach.json');
    const teachersWithContent = teachers.map(teacher => ({
      id: teacher.id,
      username: teacher.username,
      email: teacher.email,
      content: teacher.content || []
    }));

    res.json({ teachers: teachersWithContent });
  } catch (error) {
    console.error('Get teachers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Join a teacher
app.post('/api/student/join/:teacherId', requireAuth, async (req, res) => {
  try {
    if (req.session.user.role !== 'student') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { teacherId } = req.params;
    const students = await readJSONFile('student.json');
    const teachers = await readJSONFile('teach.json');

    const studentIndex = students.findIndex(s => s.id === req.session.user.id);
    const teacher = teachers.find(t => t.id === teacherId);

    if (studentIndex === -1) {
      return res.status(404).json({ error: 'Student not found' });
    }

    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    if (!students[studentIndex].joinedTeachers) {
      students[studentIndex].joinedTeachers = [];
    }

    if (students[studentIndex].joinedTeachers.includes(teacherId)) {
      return res.status(400).json({ error: 'Already joined this teacher' });
    }

    students[studentIndex].joinedTeachers.push(teacherId);
    await writeJSONFile('student.json', students);

    res.json({ message: 'Successfully joined teacher' });
    console.log(`${req.session.user.username} joined teacher: ${teacher.username}`);
  } catch (error) {
    console.error('Join teacher error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get student's joined teachers
app.get('/api/student/joined', requireAuth, async (req, res) => {
  try {
    if (req.session.user.role !== 'student') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const students = await readJSONFile('student.json');
    const student = students.find(s => s.id === req.session.user.id);

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json({ joinedTeachers: student.joinedTeachers || [] });
  } catch (error) {
    console.error('Get joined teachers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route handlers for HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/tech.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tech.html'));
});

app.get('/student.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'student.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Sriramik EduPortal is running',
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler - redirect to login for non-API routes
app.use('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'API endpoint not found' });
  } else {
    res.redirect('/');
  }
});

// Graceful error handling
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  console.error('Server will continue running...');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  console.error('Server will continue running...');
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Sriramik EduPortal running on http://0.0.0.0:${PORT}`);
  console.log(`📚 Created by Sriramik - Educational Portal System`);
  console.log(`✅ Server started successfully at ${new Date().toLocaleString()}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;