// Global state
let currentUser = null;
let teachersData = [];
let joinedTeachers = [];
let currentFilter = 'all';

// Theme management
function initializeTheme() {
    // Check for saved theme preference or default to light mode
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    
    // Set up theme toggle button
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
}

function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    // Add smooth transition effect
    document.documentElement.style.transition = 'all 0.3s ease';
    setTimeout(() => {
        document.documentElement.style.transition = '';
    }, 300);
}

// Utility functions
function showMessage(type, message, containerId = 'message-container') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `${type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'} border px-4 py-3 rounded-md mb-4`;
    messageDiv.innerHTML = `
        <div class="flex">
            <i class="fas ${type === 'error' ? 'fa-exclamation-triangle' : 'fa-check-circle'} mr-2 mt-0.5"></i>
            <span>${message}</span>
        </div>
    `;

    container.innerHTML = '';
    container.appendChild(messageDiv);

    // Auto-hide after 5 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 5000);
}

// API functions
async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(endpoint, {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'An error occurred');
        }

        return data;
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}

// Auth functions
async function checkAuth(requiredRole = null) {
    try {
        const data = await apiCall('/api/user');
        currentUser = data.user;

        if (requiredRole && currentUser.role !== requiredRole) {
            window.location.href = '/';
            return;
        }

        // Update user display
        const nameElement = document.getElementById(`${currentUser.role}-name`);
        if (nameElement) {
            nameElement.textContent = currentUser.username;
        }

        return currentUser;
    } catch (error) {
        if (error.message.includes('401') || error.message.includes('Authentication required')) {
            window.location.href = '/';
        }
        return null;
    }
}

async function logout() {
    try {
        await apiCall('/api/logout', { method: 'POST' });
        window.location.href = '/';
    } catch (error) {
        console.error('Logout failed:', error);
        window.location.href = '/';
    }
}

// Login page functions
function initializeAuth() {
    let selectedRole = 'student';

    // Role selection
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.role-btn').forEach(b => {
                b.classList.remove('active', 'border-primary-500', 'bg-primary-50');
                b.classList.add('border-gray-200');
            });
            this.classList.add('active', 'border-primary-500', 'bg-primary-50');
            this.classList.remove('border-gray-200');
            selectedRole = this.dataset.role;
        });
    });

    // Auth toggle
    document.querySelectorAll('.auth-toggle').forEach(btn => {
        btn.addEventListener('click', function() {
            const authType = this.dataset.auth;
            
            // Update button styles
            document.querySelectorAll('.auth-toggle').forEach(b => {
                b.classList.remove('bg-white', 'text-gray-900', 'shadow-sm');
                b.classList.add('text-gray-500');
            });
            this.classList.remove('text-gray-500');
            this.classList.add('bg-white', 'text-gray-900', 'shadow-sm');

            // Show/hide forms
            document.getElementById('login-form').classList.toggle('hidden', authType !== 'login');
            document.getElementById('signup-form').classList.toggle('hidden', authType !== 'signup');
        });
    });

    // Login form
    document.getElementById('login-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            await apiCall('/api/login', {
                method: 'POST',
                body: JSON.stringify({ email, password, role: selectedRole })
            });

            showMessage('success', 'Login successful! Redirecting...', 'success-message');
            
            setTimeout(() => {
                window.location.href = selectedRole === 'teacher' ? '/tech.html' : '/student.html';
            }, 1000);
        } catch (error) {
            showMessage('error', error.message, 'error-message');
        }
    });

    // Signup form
    document.getElementById('signup-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm-password').value;

        if (password !== confirmPassword) {
            showMessage('error', 'Passwords do not match', 'error-message');
            return;
        }

        try {
            await apiCall('/api/signup', {
                method: 'POST',
                body: JSON.stringify({ username, email, password, role: selectedRole })
            });

            showMessage('success', 'Account created successfully! Redirecting...', 'success-message');
            
            setTimeout(() => {
                window.location.href = selectedRole === 'teacher' ? '/tech.html' : '/student.html';
            }, 1000);
        } catch (error) {
            showMessage('error', error.message, 'error-message');
        }
    });
}

// Teacher dashboard functions
async function initializeTeacherDashboard() {
    await loadTeacherContent();
    
    // Content upload form
    document.getElementById('content-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const title = document.getElementById('content-title').value;
        const subject = document.getElementById('content-subject').value;
        const youtubeLink = document.getElementById('youtube-link').value;
        const driveLink = document.getElementById('drive-link').value;

        if (!youtubeLink && !driveLink) {
            showMessage('error', 'Please provide at least one link (YouTube or Google Drive)');
            return;
        }

        try {
            await apiCall('/api/teacher/content', {
                method: 'POST',
                body: JSON.stringify({ title, subject, youtubeLink, driveLink })
            });

            showMessage('success', 'Content uploaded successfully!');
            
            // Reset form
            this.reset();
            
            // Reload content
            await loadTeacherContent();
        } catch (error) {
            showMessage('error', error.message);
        }
    });
}

async function loadTeacherContent() {
    const loadingElement = document.getElementById('loading-content');
    const emptyElement = document.getElementById('empty-content');
    const gridElement = document.getElementById('content-grid');
    const countElement = document.getElementById('content-count');

    try {
        loadingElement.style.display = 'block';
        emptyElement.classList.add('hidden');
        gridElement.classList.add('hidden');

        const data = await apiCall('/api/teacher/content');
        const content = data.content || [];

        loadingElement.style.display = 'none';

        if (content.length === 0) {
            emptyElement.classList.remove('hidden');
        } else {
            gridElement.classList.remove('hidden');
            renderTeacherContent(content);
        }

        countElement.textContent = `${content.length} items`;
    } catch (error) {
        loadingElement.style.display = 'none';
        showMessage('error', 'Failed to load content: ' + error.message);
    }
}

function renderTeacherContent(content) {
    const gridElement = document.getElementById('content-grid');
    gridElement.innerHTML = '';

    content.forEach(item => {
        const card = createContentCard(item, true);
        gridElement.appendChild(card);
    });
}

async function deleteContent(contentId) {
    if (!confirm('Are you sure you want to delete this content?')) {
        return;
    }

    try {
        await apiCall(`/api/teacher/content/${contentId}`, { method: 'DELETE' });
        showMessage('success', 'Content deleted successfully!');
        await loadTeacherContent();
    } catch (error) {
        showMessage('error', 'Failed to delete content: ' + error.message);
    }
}

// Student dashboard functions
async function initializeStudentDashboard() {
    await loadStudentData();
    
    // Search functionality
    document.getElementById('search-input').addEventListener('input', filterContent);
    document.getElementById('subject-filter').addEventListener('change', filterContent);
    
    // Filter buttons
    document.getElementById('filter-all').addEventListener('click', () => setFilter('all'));
    document.getElementById('filter-joined').addEventListener('click', () => setFilter('joined'));
}

async function loadStudentData() {
    const loadingElement = document.getElementById('loading-teachers');
    const emptyElement = document.getElementById('empty-teachers');
    const contentElement = document.getElementById('teachers-content');

    try {
        loadingElement.style.display = 'block';
        emptyElement.classList.add('hidden');
        contentElement.classList.add('hidden');

        // Load teachers and joined teachers data
        const [teachersResponse, joinedResponse] = await Promise.all([
            apiCall('/api/teachers'),
            apiCall('/api/student/joined')
        ]);

        teachersData = teachersResponse.teachers || [];
        joinedTeachers = joinedResponse.joinedTeachers || [];

        loadingElement.style.display = 'none';

        if (teachersData.length === 0) {
            emptyElement.classList.remove('hidden');
        } else {
            contentElement.classList.remove('hidden');
            renderStudentContent();
        }

        updateStudentStats();
    } catch (error) {
        loadingElement.style.display = 'none';
        showMessage('error', 'Failed to load content: ' + error.message);
    }
}

function updateStudentStats() {
    const totalContent = teachersData.reduce((sum, teacher) => sum + (teacher.content?.length || 0), 0);
    
    document.getElementById('total-content').textContent = totalContent;
    document.getElementById('joined-count').textContent = joinedTeachers.length;
    document.getElementById('total-teachers').textContent = teachersData.length;
}

function renderStudentContent() {
    const contentElement = document.getElementById('teachers-content');
    contentElement.innerHTML = '';

    const filteredTeachers = getFilteredTeachers();

    filteredTeachers.forEach(teacher => {
        if (teacher.content && teacher.content.length > 0) {
            const section = createTeacherSection(teacher);
            contentElement.appendChild(section);
        }
    });
}

function getFilteredTeachers() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const subjectFilter = document.getElementById('subject-filter').value;

    let filtered = teachersData;

    // Filter by joined teachers
    if (currentFilter === 'joined') {
        filtered = filtered.filter(teacher => joinedTeachers.includes(teacher.id));
    }

    // Filter by search and subject
    filtered = filtered.map(teacher => ({
        ...teacher,
        content: (teacher.content || []).filter(content => {
            const matchesSearch = !searchTerm || 
                content.title.toLowerCase().includes(searchTerm) ||
                content.subject.toLowerCase().includes(searchTerm);
            
            const matchesSubject = !subjectFilter || content.subject === subjectFilter;
            
            return matchesSearch && matchesSubject;
        })
    })).filter(teacher => teacher.content.length > 0);

    return filtered;
}

function setFilter(filter) {
    currentFilter = filter;
    
    // Update button styles
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('bg-primary-500', 'text-white');
        btn.classList.add('bg-gray-100', 'text-gray-700');
    });
    
    const activeBtn = filter === 'all' ? 'filter-all' : 'filter-joined';
    const activeBtnElement = document.getElementById(activeBtn);
    activeBtnElement.classList.remove('bg-gray-100', 'text-gray-700');
    activeBtnElement.classList.add('bg-primary-500', 'text-white');
    
    renderStudentContent();
}

function filterContent() {
    renderStudentContent();
}

function createTeacherSection(teacher) {
    const isJoined = joinedTeachers.includes(teacher.id);
    const section = document.createElement('div');
    section.className = 'bg-white rounded-lg shadow-md overflow-hidden';
    
    const gradientColors = [
        'from-primary-500 to-primary-600',
        'from-success-500 to-success-600',
        'from-purple-500 to-purple-600',
        'from-indigo-500 to-indigo-600',
        'from-pink-500 to-pink-600'
    ];
    
    const gradient = gradientColors[Math.abs(teacher.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % gradientColors.length];
    
    section.innerHTML = `
        <div class="bg-gradient-to-r ${gradient} px-6 py-4">
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-4">
                    <div class="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                        <i class="fas fa-user text-white text-lg"></i>
                    </div>
                    <div>
                        <h3 class="text-lg font-semibold text-white">${teacher.username}</h3>
                        <p class="text-white text-opacity-75 text-sm">${teacher.email}</p>
                    </div>
                </div>
                <button onclick="joinTeacher('${teacher.id}')" class="${isJoined ? 'bg-white bg-opacity-30 cursor-default' : 'bg-white bg-opacity-20 hover:bg-opacity-30'} text-white px-4 py-2 rounded-md transition-all duration-300 font-medium" ${isJoined ? 'disabled' : ''}>
                    <i class="fas ${isJoined ? 'fa-check' : 'fa-user-plus'} mr-2"></i>${isJoined ? 'Joined' : 'Join Teacher'}
                </button>
            </div>
        </div>
        <div class="p-6">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${teacher.content.map(content => createContentCard(content, false).outerHTML).join('')}
            </div>
        </div>
    `;
    
    return section;
}

function createContentCard(content, showActions = false) {
    const card = document.createElement('div');
    card.className = `${showActions ? 'bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300' : 'group cursor-pointer'}`;
    
    const subjectColors = {
        'Mathematics': 'bg-primary-100 text-primary-800',
        'Science': 'bg-success-100 text-success-800',
        'Physics': 'bg-success-100 text-success-800',
        'Chemistry': 'bg-success-100 text-success-800',
        'Biology': 'bg-green-100 text-green-800',
        'Computer Science': 'bg-warning-100 text-warning-800',
        'English': 'bg-purple-100 text-purple-800',
        'History': 'bg-indigo-100 text-indigo-800'
    };
    
    const subjectColor = subjectColors[content.subject] || 'bg-gray-100 text-gray-800';
    
    let mediaContent = '';
    if (content.youtubeId) {
        mediaContent = `<iframe src="https://www.youtube.com/embed/${content.youtubeId}" class="w-full h-full" frameborder="0" allowfullscreen></iframe>`;
    } else if (content.driveId) {
        mediaContent = `<iframe src="https://drive.google.com/file/d/${content.driveId}/preview" class="w-full h-full" frameborder="0"></iframe>`;
    } else {
        mediaContent = `<div class="flex items-center justify-center h-full bg-gray-200">
            <i class="fas fa-file text-4xl text-gray-400"></i>
        </div>`;
    }
    
    card.innerHTML = `
        <div class="aspect-video bg-gray-100 ${showActions ? '' : 'rounded-lg overflow-hidden mb-3'}">
            ${mediaContent}
        </div>
        <div class="${showActions ? 'p-4' : ''}">
            <div class="flex items-center justify-between mb-2">
                <span class="inline-block ${subjectColor} text-xs px-2 py-1 rounded-full font-medium">${content.subject}</span>
                ${showActions ? `
                    <div class="flex space-x-2">
                        <button onclick="deleteContent('${content.id}')" class="text-gray-400 hover:text-red-500 transition-colors">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                ` : ''}
            </div>
            <h4 class="font-semibold text-gray-900 ${showActions ? 'mb-2' : 'group-hover:text-primary-500 transition-colors'}">${content.title}</h4>
            ${showActions ? `
                <div class="flex items-center text-xs text-gray-500">
                    <i class="fas fa-calendar mr-1"></i>
                    <span>Uploaded ${new Date(content.createdAt).toLocaleDateString()}</span>
                </div>
            ` : ''}
        </div>
    `;
    
    return card;
}

async function joinTeacher(teacherId) {
    try {
        await apiCall(`/api/student/join/${teacherId}`, { method: 'POST' });
        showMessage('success', 'Successfully joined teacher!');
        
        // Update joined teachers list
        joinedTeachers.push(teacherId);
        
        // Re-render content to update button states
        renderStudentContent();
        updateStudentStats();
    } catch (error) {
        showMessage('error', error.message);
    }
}
