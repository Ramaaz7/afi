// Afi's Routine - Firebase Cloud Version
// NOTE: Replace the config below with your actual Firebase project settings!
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase with safety check
let db;
try {
    if (firebaseConfig.apiKey === "YOUR_API_KEY") {
        console.warn("Firebase not configured! Using local-only mode. Please set your credentials in app.js.");
        db = {
            collection: () => ({
                doc: () => ({
                    get: () => Promise.resolve({ exists: false }),
                    set: () => Promise.resolve(),
                    update: () => Promise.resolve(),
                    onSnapshot: () => (() => {})
                }),
                add: () => Promise.resolve(),
                where: () => ({ where: () => ({ onSnapshot: () => (() => {}) }), onSnapshot: () => (() => {}) }),
                orderBy: () => ({ onSnapshot: () => (() => {}), orderBy: () => ({ onSnapshot: () => (() => {}) }) })
            })
        };
    } else {
        const app = firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
    }
} catch (err) {
    console.error("Firebase init error:", err);
}

// State & State Management
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let activeTab = 'tab-schedule';
let map = null;
let markers = {};
let listeners = {}; // Store active listeners to unsubscribe

// UI Helpers
const $ = (id) => document.getElementById(id);
const q = (selector) => document.querySelector(selector);
const qa = (selector) => document.querySelectorAll(selector);

// 4. Initialization & Auth
async function initApp() {
    if (currentUser) {
        showApp();
    } else {
        showLogin();
    }
    
    lucide.createIcons();
    setupEventListeners();
}

function showLogin() {
    $('login-overlay').classList.remove('hidden');
    $('app-content').classList.add('hidden');
    Object.values(listeners).forEach(unsubscribe => unsubscribe()); // Cleanup listeners
}

function showApp() {
    $('login-overlay').classList.add('hidden');
    $('app-content').classList.remove('hidden');
    $('nav-username').textContent = currentUser.username;
    $('user-avatar-initial').textContent = currentUser.username[0].toUpperCase();
    
    // Set partner display name
    const partnerName = currentUser.username === 'afra' ? 'Ramaaz' : 'Afra';
    $('partner-name-display').textContent = partnerName;
    
    switchTab(activeTab);
    updateScheduleHeader();
}

// 5. Event Listeners
function setupEventListeners() {
    // Login Form (Simulated for now, could be replaced with Firebase Auth)
    $('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const usernameInput = $('username').value.toLowerCase().trim();
        const passwordInput = $('password').value;

        // Hardcoded credentials as per instructions.md
        const validUsers = [
            { username: 'afra', password: 'afi123' },
            { username: 'ramaaz', password: 'afi123' }
        ];

        const user = validUsers.find(u => u.username === usernameInput && u.password === passwordInput);
        if (user) {
            $('login-error').classList.add('hidden');
            // Fetch profile from Firestore with error handling
            let profile = { 
                username: user.username, 
                displayName: user.username.charAt(0).toUpperCase() + user.username.slice(1),
                avatarUrl: `https://ui-avatars.com/api/?name=${user.username}&background=6366f1&color=fff`
            };

            try {
                const userDoc = await db.collection('users').doc(user.username).get();
                if (userDoc.exists) {
                    profile = userDoc.data();
                } else {
                    await db.collection('users').doc(user.username).set(profile);
                }
            } catch (err) {
                console.error("Firebase fetch error (Check your config!):", err);
                // Continue with local profile if Firebase fails
            }

            currentUser = { ...user, ...profile };
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showApp();
        } else {
            $('login-error').classList.remove('hidden');
            $('password').value = '';
            $('password').focus();
        }
    });

    // Toggle Password Visibility
    $('toggle-password').addEventListener('click', () => {
        const passwordInput = $('password');
        const icon = $('toggle-password').querySelector('i');
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            icon.setAttribute('data-lucide', 'eye-off');
        } else {
            passwordInput.type = 'password';
            icon.setAttribute('data-lucide', 'eye');
        }
        lucide.createIcons();
    });

    // Logout
    $('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('currentUser');
        currentUser = null;
        showLogin();
    });

    // Tab Switching
    qa('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            switchTab(tabId);
        });
    });

    // Checklist Form
    $('checklist-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const item = $('checklist-input').value.trim();
        if (item) {
            await db.collection('checklist').add({
                item,
                status: 'pending',
                assignedTo: 'both',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            $('checklist-input').value = '';
        }
    });

    // Chat Form
    $('chat-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = $('chat-input').value.trim();
        if (text) {
            await db.collection('messages').add({
                sender: currentUser.username,
                text,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            $('chat-input').value = '';
        }
    });

    // Timetable Modal
    $('close-modal').addEventListener('click', () => {
        $('task-modal').classList.add('hidden');
    });

    $('task-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const taskId = $('task-id').value;
        const taskText = $('task-input').value.trim();
        const taskTime = $('task-time').value;
        const day = $('day-selector').value;

        if (taskId) {
            await db.collection('timetable').doc(taskId).update({ task: taskText });
        } else {
            await db.collection('timetable').add({
                user: currentUser.username,
                day,
                time: taskTime,
                task: taskText,
                completed: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        $('task-modal').classList.add('hidden');
    });

    // Day Selector
    $('day-selector').addEventListener('change', () => {
        setupScheduleListener();
    });

    // Location Share
    $('share-location-btn').addEventListener('click', async () => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(async (pos) => {
                const { latitude, longitude } = pos.coords;
                
                await db.collection('locations').doc(currentUser.username).set({
                    username: currentUser.username,
                    lat: latitude,
                    lng: longitude,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                alert('Location shared successfully!');
            }, (err) => {
                alert('Geolocation error: ' + err.message);
            });
        }
    });

    // Profile Settings Form
    $('settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const displayName = $('display-name-input').value.trim();
        const newPassword = $('new-password-input').value.trim();
        const avatarUrl = $('custom-avatar-url').value.trim();

        const updates = { displayName };
        if (avatarUrl) updates.avatarUrl = avatarUrl;
        
        await db.collection('users').doc(currentUser.username).update(updates);
        
        // Update local state
        currentUser.displayName = displayName;
        if (avatarUrl) currentUser.avatarUrl = avatarUrl;
        if (newPassword) {
            // Note: In a real app, you'd update Firebase Auth password. 
            // Here we just update the Firestore record for simulation.
            await db.collection('users').doc(currentUser.username).update({ password: newPassword });
            currentUser.password = newPassword;
        }
        
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        alert('Profile updated successfully!');
        showApp();
    });

    // File Upload Listener
    $('avatar-file-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target.result;
                $('profile-preview').src = base64;
                $('custom-avatar-url').value = base64; // Store base64 in the same field for simplicity
            };
            reader.readAsDataURL(file);
        }
    });
}

// 6. Tab Management
function switchTab(tabId) {
    activeTab = tabId;
    
    // Clear old listeners if needed (not strictly necessary but cleaner)
    // Object.values(listeners).forEach(u => u());
    
    qa('.nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    qa('.tab-pane').forEach(pane => {
        pane.classList.toggle('hidden', pane.id !== tabId);
        pane.classList.toggle('active', pane.id === tabId);
    });

    renderTab(tabId);
}

function renderTab(tabId) {
    switch (tabId) {
        case 'tab-schedule': setupScheduleListener(); break;
        case 'tab-checklist': setupChecklistListener(); break;
        case 'tab-chat': setupChatListener(); break;
        case 'tab-map': renderMap(); break;
        case 'tab-settings': loadSettings(); break;
    }
}

function loadSettings() {
    $('display-name-input').value = currentUser.displayName || '';
    $('username-id-input').value = currentUser.username;
    $('custom-avatar-url').value = currentUser.avatarUrl || '';
    $('profile-preview').src = currentUser.avatarUrl || `https://ui-avatars.com/api/?name=${currentUser.username}&background=6366f1&color=fff`;
}

// 7. Feature Implementations with REAL-TIME SYNC

// --- Schedule/Timetable ---
function setupScheduleListener() {
    if (listeners.schedule) listeners.schedule();
    const day = $('day-selector').value;

    listeners.schedule = db.collection('timetable')
        .where('user', '==', currentUser.username)
        .where('day', '==', day)
        .onSnapshot(snapshot => {
            const tasks = {};
            snapshot.forEach(doc => {
                tasks[doc.data().time] = { id: doc.id, ...doc.data() };
            });
            renderTimetable(tasks);
        });
}

function renderTimetable(taskMap) {
    const grid = $('timetable-grid');
    grid.innerHTML = '';
    
    for (let i = 8; i <= 22; i++) {
        const timeStr = `${i < 10 ? '0' + i : i}:00`;
        const task = taskMap[timeStr];
        
        const row = document.createElement('div');
        row.className = `timetable-row flex items-center p-4 min-h-[80px] transition-colors hover:bg-slate-50 relative group`;
        
        row.innerHTML = `
            <div class="w-20 text-sm font-bold text-slate-400">${timeStr}</div>
            <div class="flex-1 flex items-center gap-4">
                ${task ? `
                    <div class="flex-1 p-3 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-between group/task transition-all hover:shadow-md">
                        <div class="flex items-center gap-3">
                            <input type="checkbox" ${task.completed ? 'checked' : ''} 
                                onchange="toggleTask('${task.id}', this.checked)"
                                class="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500">
                            <span class="text-sm font-medium ${task.completed ? 'line-through text-slate-400' : 'text-slate-700'}">${task.task}</span>
                        </div>
                        <div class="flex gap-1 opacity-0 group-hover/task:opacity-100 transition-opacity">
                            <button onclick="editTask('${task.id}', '${task.task}', '${task.time}')" class="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors">
                                <i data-lucide="edit-3" class="w-4 h-4"></i>
                            </button>
                            <button onclick="deleteTask('${task.id}')" class="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>
                ` : `
                    <button onclick="openAddTask('${timeStr}')" class="add-task-btn absolute inset-0 md:relative md:flex items-center gap-2 text-slate-300 hover:text-indigo-600 px-3 py-1 rounded-lg hover:bg-white border-2 border-dashed border-transparent hover:border-indigo-100 transition-all font-medium text-sm">
                        <i data-lucide="plus-circle" class="w-4 h-4"></i>
                        <span>Add something to do...</span>
                    </button>
                `}
            </div>
        `;
        grid.appendChild(row);
    }
    lucide.createIcons();
}

window.openAddTask = (time) => {
    $('modal-title').textContent = `Add task for ${time}`;
    $('task-id').value = '';
    $('task-time').value = time;
    $('task-input').value = '';
    $('task-modal').classList.remove('hidden');
    $('task-input').focus();
};

window.editTask = (id, currentText, time) => {
    $('modal-title').textContent = `Edit task for ${time}`;
    $('task-id').value = id;
    $('task-time').value = time;
    $('task-input').value = currentText;
    $('task-modal').classList.remove('hidden');
    $('task-input').focus();
};

window.deleteTask = async (id) => {
    if (confirm('Delete this task?')) {
        await db.collection('timetable').doc(id).delete();
    }
};

window.toggleTask = async (id, status) => {
    await db.collection('timetable').doc(id).update({ completed: status });
};

// --- Checklist ---
function setupChecklistListener() {
    if (listeners.checklist) listeners.checklist();
    listeners.checklist = db.collection('checklist').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        const container = $('checklist-items');
        container.innerHTML = '';
        
        if (snapshot.empty) {
            container.innerHTML = `
                <div class="text-center py-8 text-slate-400">
                    <i data-lucide="clipboard-list" class="w-12 h-12 mx-auto mb-2 opacity-50"></i>
                    <p>No items in the checklist yet.</p>
                </div>
            `;
        } else {
            snapshot.forEach(doc => {
                const item = { id: doc.id, ...doc.data() };
                const div = document.createElement('div');
                div.className = `flex items-center justify-between p-3 rounded-xl border border-slate-100 transition-all ${item.status === 'done' ? 'bg-slate-50' : 'bg-white hover:border-indigo-100'}`;
                div.innerHTML = `
                    <div class="flex items-center gap-3">
                        <input type="checkbox" ${item.status === 'done' ? 'checked' : ''} 
                            onchange="toggleChecklistItem('${item.id}', this.checked)"
                            class="w-5 h-5 rounded-full border-slate-300 text-indigo-600 focus:ring-indigo-500">
                        <span class="text-sm font-medium ${item.status === 'done' ? 'line-through text-slate-400' : 'text-slate-700'}">${item.item}</span>
                    </div>
                    <button onclick="deleteChecklistItem('${item.id}')" class="text-slate-300 hover:text-red-500 transition-colors">
                        <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                `;
                container.appendChild(div);
            });
        }
        lucide.createIcons();
    });
}

window.toggleChecklistItem = async (id, checked) => {
    await db.collection('checklist').doc(id).update({ status: checked ? 'done' : 'pending' });
};

window.deleteChecklistItem = async (id) => {
    await db.collection('checklist').doc(id).delete();
};

// --- Chat ---
function setupChatListener() {
    if (listeners.chat) listeners.chat();
    listeners.chat = db.collection('messages').orderBy('timestamp', 'asc').onSnapshot(async snapshot => {
        const container = $('chat-messages');
        container.innerHTML = '';
        
        // Fetch all users to get display names and avatars
        const userDocs = await db.collection('users').get();
        const userData = {};
        userDocs.forEach(doc => userData[doc.id] = doc.data());

        snapshot.forEach(doc => {
            const msg = doc.data();
            const isMine = msg.sender === currentUser.username;
            const senderProfile = userData[msg.sender] || { displayName: msg.sender };
            const div = document.createElement('div');
            div.className = `fade-in flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'} mb-4`;
            
            const timestamp = msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...';
            const avatar = senderProfile.avatarUrl || `https://ui-avatars.com/api/?name=${msg.sender}&background=6366f1&color=fff`;

            div.innerHTML = `
                <img src="${avatar}" class="w-8 h-8 rounded-full shadow-sm">
                <div class="flex flex-col max-w-[80%] ${isMine ? 'items-end' : 'items-start'}">
                    <span class="text-[10px] font-bold text-slate-400 mb-0.5 px-1">${senderProfile.displayName}</span>
                    <div class="message-bubble ${isMine ? 'mine' : 'theirs'}">
                        ${msg.text}
                    </div>
                    <span class="text-[10px] text-slate-400 mt-1 px-1">${timestamp}</span>
                </div>
            `;
            container.appendChild(div);
        });
        
        container.scrollTop = container.scrollHeight;
    });
}

// --- Map ---
function renderMap() {
    if (map) {
        setTimeout(() => map.invalidateSize(), 300);
        return;
    }

    setTimeout(() => {
        map = L.map('map').setView([0, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        setupLocationListener();
    }, 100);
}

function setupLocationListener() {
    if (listeners.locations) listeners.locations();
    listeners.locations = db.collection('locations').onSnapshot(snapshot => {
        const bounds = [];
        
        snapshot.forEach(doc => {
            const loc = doc.data();
            if (markers[loc.username]) {
                map.removeLayer(markers[loc.username]);
            }
            
            const isMe = loc.username === currentUser.username;
            const color = isMe ? '#4f46e5' : '#ef4444';
            
            const customIcon = L.divIcon({
                className: 'custom-div-icon',
                html: `<div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-center; color: white; font-weight: bold; font-size: 10px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);"><span style="margin: auto">${loc.username[0].toUpperCase()}</span></div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });

            const timestamp = loc.lastUpdated ? new Date(loc.lastUpdated.toDate()).toLocaleTimeString() : '...';

            markers[loc.username] = L.marker([loc.lat, loc.lng], { icon: customIcon })
                .addTo(map)
                .bindPopup(`<b>${loc.username === currentUser.username ? 'You' : loc.username}</b><br>Last updated: ${timestamp}`);
            
            bounds.push([loc.lat, loc.lng]);
        });

        if (bounds.length > 0 && activeTab === 'tab-map') {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
        }
    });
}

// Helpers
function updateScheduleHeader() {
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    $('schedule-date').textContent = new Date().toLocaleDateString(undefined, options);
}

// Initialize
initApp();
