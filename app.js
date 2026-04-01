// Afi's Routine - Firebase Cloud Version
// NOTE: Replace the config below with your actual Firebase project settings!
const firebaseConfig = {
    apiKey: "AIzaSyB26iAOEEyDqFRAia4HW4OLSMaml9w_r-4",
    authDomain: "afi-s-routine.firebaseapp.com",
    projectId: "afi-s-routine",
    storageBucket: "afi-s-routine.firebasestorage.app",
    messagingSenderId: "122190065109",
    appId: "1:122190065109:web:878b740114a1246e68e15c"
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
let listeners = {}; 

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
    Object.values(listeners).forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') unsubscribe();
        else clearInterval(unsubscribe);
    }); 
}

function showApp() {
    $('login-overlay').classList.add('hidden');
    $('app-content').classList.remove('hidden');
    $('nav-username').textContent = currentUser.displayName || currentUser.username;
    $('user-avatar-initial').textContent = (currentUser.displayName || currentUser.username)[0].toUpperCase();
    
    // Set partner display name
    const partnerName = currentUser.username === 'afra' ? 'Ramaaz' : 'Afra';
    $('partner-name-display').textContent = partnerName;
    
    switchTab(activeTab);
    updateScheduleHeader();
}

// 5. Event Listeners
function setupEventListeners() {
    // Login Form
    $('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const usernameInput = $('username').value.toLowerCase().trim();
        const passwordInput = $('password').value;

        const validUsers = [
            { username: 'afra', password: 'afi123' },
            { username: 'ramaaz', password: 'afi123' }
        ];

        const user = validUsers.find(u => u.username === usernameInput && u.password === passwordInput);
        if (user) {
            $('login-error').classList.add('hidden');
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
                console.error("Firebase fetch error:", err);
            }

            currentUser = { ...user, ...profile };
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showApp();
        } else {
            $('login-error').classList.remove('hidden');
            $('password').type = 'password';
            $('password').value = '';
            $('password').focus();
            const icon = $('toggle-password').querySelector('i');
            icon.setAttribute('data-lucide', 'eye');
            lucide.createIcons();
        }
    });

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

    qa('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            switchTab(tabId);
        });
    });

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

    $('chat-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = $('chat-input').value.trim();
        if (text) {
            const msg = {
                sender: currentUser.username,
                text,
                timestamp: firebase.firestore ? firebase.firestore.FieldValue.serverTimestamp() : new Date()
            };
            
            try {
                await db.collection('messages').add(msg);
                // Trigger local update for mock mode
                if (firebaseConfig.apiKey === "YOUR_API_KEY") {
                    const localMsgs = JSON.parse(localStorage.getItem('mock_messages') || '[]');
                    localMsgs.push({ ...msg, timestamp: new Date().toISOString(), id: Date.now() });
                    localStorage.setItem('mock_messages', JSON.stringify(localMsgs));
                    window.dispatchEvent(new Event('mock_chat_update'));
                }
            } catch (err) {
                console.error("Chat send error:", err);
            }
            $('chat-input').value = '';
        }
    });

    $('close-modal').addEventListener('click', () => $('task-modal').classList.add('hidden'));
    
    // Profile Modal logic
    $('close-profile-modal').addEventListener('click', () => {
        $('profile-modal').classList.add('hidden');
    });
    
    // Clicking outside modal to close
    $('profile-modal').addEventListener('click', (e) => {
        if (e.target.id === 'profile-modal') $('profile-modal').classList.add('hidden');
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

    $('day-selector').addEventListener('change', () => setupScheduleListener());

    $('share-location-btn').addEventListener('click', () => startLocationSharing());

    $('settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const displayName = $('display-name-input').value.trim();
        const newPassword = $('new-password-input').value.trim();
        const avatarUrl = $('custom-avatar-url').value.trim();

        const updates = { displayName };
        if (avatarUrl) updates.avatarUrl = avatarUrl;
        
        await db.collection('users').doc(currentUser.username).update(updates);
        
        currentUser.displayName = displayName;
        if (avatarUrl) currentUser.avatarUrl = avatarUrl;
        if (newPassword) {
            await db.collection('users').doc(currentUser.username).update({ password: newPassword });
            currentUser.password = newPassword;
        }
        
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        alert('Profile updated successfully!');
        showApp();
    });

    $('avatar-file-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target.result;
                $('profile-preview').src = base64;
                $('custom-avatar-url').value = base64;
            };
            reader.readAsDataURL(file);
        }
    });
}

function startLocationSharing() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
            await updateLocation(pos.coords.latitude, pos.coords.longitude);
            alert('Live sharing started! Location updates every 30s.');
            
            if (listeners.locationSync) clearInterval(listeners.locationSync);
            listeners.locationSync = setInterval(() => {
                navigator.geolocation.getCurrentPosition(async (newPos) => {
                    await updateLocation(newPos.coords.latitude, newPos.coords.longitude);
                });
            }, 30000);
        }, (err) => alert('Geolocation error: ' + err.message));
    }
}

async function updateLocation(lat, lng) {
    try {
        await db.collection('locations').doc(currentUser.username).set({
            username: currentUser.username,
            lat: lat,
            lng: lng,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.error("Failed to share location:", e);
    }
}

// 6. Tab Management
function switchTab(tabId) {
    activeTab = tabId;
    qa('.nav-item').forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId));
    qa('.tab-pane').forEach(pane => {
        pane.classList.toggle('hidden', pane.id !== tabId);
        pane.classList.toggle('active', pane.id === tabId);
    });
    if (tabId === 'tab-map' && map) setTimeout(() => map.invalidateSize(), 300);
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
    lucide.createIcons();
}

function loadSettings() {
    $('display-name-input').value = currentUser.displayName || '';
    $('username-id-input').value = currentUser.username;
    $('custom-avatar-url').value = currentUser.avatarUrl || '';
    $('profile-preview').src = currentUser.avatarUrl || `https://ui-avatars.com/api/?name=${currentUser.username}&background=6366f1&color=fff`;
}

// 7. Feature Implementations
function setupScheduleListener() {
    if (listeners.schedule) listeners.schedule();
    const day = $('day-selector').value;
    listeners.schedule = db.collection('timetable')
        .where('user', '==', currentUser.username).where('day', '==', day)
        .onSnapshot(snapshot => {
            const tasks = {};
            snapshot.forEach(doc => tasks[doc.data().time] = { id: doc.id, ...doc.data() });
            renderTimetable(tasks);
        });
}

function renderTimetable(taskMap) {
    const grid = $('timetable-grid'); grid.innerHTML = '';
    for (let i = 8; i <= 22; i++) {
        const timeStr = `${i < 10 ? '0' + i : i}:00`;
        const task = taskMap[timeStr];
        const row = document.createElement('div');
        row.className = `timetable-row flex items-center p-4 min-h-[80px] transition-colors hover:bg-slate-50 relative group`;
        row.innerHTML = `
            <div class="w-16 md:w-20 text-[10px] md:text-sm font-bold text-slate-400">${timeStr}</div>
            <div class="flex-1 flex items-center gap-4">
                ${task ? `
                    <div class="flex-1 p-3 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-between group/task transition-all hover:shadow-md">
                        <div class="flex items-center gap-3">
                            <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask('${task.id}', this.checked)" class="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500">
                            <span class="text-sm font-medium ${task.completed ? 'line-through text-slate-400' : 'text-slate-700'}">${task.task}</span>
                        </div>
                        <div class="flex gap-1 opacity-0 md:group-hover/task:opacity-100 transition-opacity">
                            <button onclick="editTask('${task.id}', '${task.task}', '${task.time}')" class="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
                            <button onclick="deleteTask('${task.id}')" class="p-1.5 text-slate-400 hover:text-red-500 transition-colors"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                        </div>
                    </div>
                ` : `
                    <button onclick="openAddTask('${timeStr}')" class="add-task-btn flex items-center gap-2 text-slate-400 hover:text-indigo-600 px-3 py-2 rounded-lg hover:bg-white border border-dashed border-slate-200 hover:border-indigo-100 transition-all font-medium text-xs">
                        <i data-lucide="plus-circle" class="w-4 h-4"></i><span>Add Task</span>
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
    $('task-id').value = ''; $('task-time').value = time; $('task-input').value = '';
    $('task-modal').classList.remove('hidden'); $('task-input').focus();
};
window.editTask = (id, currentText, time) => {
    $('modal-title').textContent = `Edit task for ${time}`;
    $('task-id').value = id; $('task-time').value = time; $('task-input').value = currentText;
    $('task-modal').classList.remove('hidden'); $('task-input').focus();
};
window.deleteTask = id => confirm('Delete?') && db.collection('timetable').doc(id).delete();
window.toggleTask = (id, status) => db.collection('timetable').doc(id).update({ completed: status });

function setupChecklistListener() {
    if (listeners.checklist) listeners.checklist();
    listeners.checklist = db.collection('checklist').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        const container = $('checklist-items'); container.innerHTML = '';
        if (snapshot.empty) {
            container.innerHTML = `<div class="text-center py-8 text-slate-400"><i data-lucide="clipboard-list" class="w-12 h-12 mx-auto mb-2 opacity-50"></i><p>No items yet.</p></div>`;
        } else {
            snapshot.forEach(doc => {
                const item = { id: doc.id, ...doc.data() };
                const div = document.createElement('div');
                div.className = `flex items-center justify-between p-3 rounded-xl border border-slate-100 transition-all ${item.status === 'done' ? 'bg-slate-50' : 'bg-white'}`;
                div.innerHTML = `
                    <div class="flex items-center gap-3">
                        <input type="checkbox" ${item.status === 'done' ? 'checked' : ''} onchange="toggleChecklistItem('${item.id}', this.checked)" class="w-5 h-5 rounded-full border-slate-300 text-indigo-600 focus:ring-indigo-500">
                        <span class="text-sm font-medium ${item.status === 'done' ? 'line-through text-slate-400' : 'text-slate-700'}">${item.item}</span>
                    </div>
                    <button onclick="deleteChecklistItem('${item.id}')" class="text-slate-300 hover:text-red-500"><i data-lucide="x" class="w-4 h-4"></i></button>
                `;
                container.appendChild(div);
            });
        }
        lucide.createIcons();
    });
}
window.toggleChecklistItem = (id, checked) => db.collection('checklist').doc(id).update({ status: checked ? 'done' : 'pending' });
window.deleteChecklistItem = id => db.collection('checklist').doc(id).delete();

let chatUserDataCache = {};

function setupChatListener() {
    if (listeners.chat) listeners.chat();

    if (firebaseConfig.apiKey === "YOUR_API_KEY") {
        // Mock mode: listen to local storage events
        const updateMockChat = () => {
             const msgs = JSON.parse(localStorage.getItem('mock_messages') || '[]');
             renderChatMessages(msgs.map(m => ({...m, timestamp: { toDate: () => new Date(m.timestamp) } })));
        };
        window.addEventListener('mock_chat_update', updateMockChat);
        updateMockChat();
        listeners.chat = () => window.removeEventListener('mock_chat_update', updateMockChat);
        return;
    }

    listeners.chat = db.collection('messages').orderBy('timestamp', 'asc').onSnapshot(async snapshot => {
        // Build user cache once to prevent lagging on every message
        if (Object.keys(chatUserDataCache).length === 0) {
            try {
                const userDocs = await db.collection('users').get();
                userDocs.forEach(doc => { chatUserDataCache[doc.id] = doc.data(); });
            } catch (e) {
                console.warn("Could not fetch user cache for chat");
            }
        }
        
        const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderChatMessages(msgs);
    });
}

function renderChatMessages(msgs) {
    const container = $('chat-messages');
    container.innerHTML = '';

    msgs.forEach(msg => {
        if (!msg.text) return;

        const isMine = msg.sender === currentUser.username;
        const senderProfile = chatUserDataCache[msg.sender] || { displayName: msg.sender };
        const avatar = senderProfile.avatarUrl || `https://ui-avatars.com/api/?name=${msg.sender}&background=6366f1&color=fff`;

        const div = document.createElement('div');
        div.className = `fade-in flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'} mb-2`;

        if (isMine) {
            div.innerHTML = `
                <div class="flex flex-col items-end w-full">
                    <div class="message-bubble mine px-4 py-2.5 shadow-sm text-sm">
                        ${msg.text}
                    </div>
                </div>
            `;
        } else {
            div.innerHTML = `
                <img src="${avatar}" onclick="viewProfile('${msg.sender}')" class="w-7 h-7 rounded-full object-cover flex-shrink-0 self-end mb-1 border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity">
                <div class="flex flex-col items-start max-w-[75%]">
                    <div class="message-bubble theirs px-4 py-2.5 shadow-sm text-sm">
                        ${msg.text}
                    </div>
                </div>
            `;
        }
        container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
    lucide.createIcons();
}

window.viewProfile = (username) => {
    const profile = chatUserDataCache[username] || { displayName: username, avatarUrl: `https://ui-avatars.com/api/?name=${username}&background=6366f1&color=fff` };
    $('modal-profile-img').src = profile.avatarUrl;
    $('modal-profile-name').textContent = profile.displayName || username;
    $('modal-profile-username').textContent = '@' + username;
    $('profile-modal').classList.remove('hidden');
};

function renderMap() {
    if (map) {
        setTimeout(() => map.invalidateSize(), 300);
        return;
    }
    
    if (typeof L === 'undefined') {
        console.error("Leaflet library failed to load.");
        return;
    }

    setTimeout(() => {
        if (map) return;
        
        const mapContainer = $('map');
        if (!mapContainer) return;

        map = L.map('map', { zoomControl: false }).setView([20, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        L.control.zoom({ position: 'bottomright' }).addTo(map);
        
        // Ensure tiles are drawn correctly after the element is visible
        setTimeout(() => { map.invalidateSize(); }, 300);
        
        setupLocationListener();
    }, 150);
}

function setupLocationListener() {
    if (listeners.locations) listeners.locations();
    
    listeners.locations = db.collection('locations').onSnapshot(snapshot => {
        const bounds = [];
        
        snapshot.forEach(doc => {
            const loc = doc.data();
            
            // Safety check to ensure valid map data
            if (!loc || !loc.username || loc.lat === undefined || loc.lng === undefined) return;
            
            if (markers[loc.username]) {
                map.removeLayer(markers[loc.username]);
            }
            
            const isMe = loc.username === currentUser.username;
            const color = isMe ? '#4f46e5' : '#ef4444';
            const initials = typeof loc.username === 'string' && loc.username.length > 0 ? loc.username[0].toUpperCase() : '?';
            
            const customIcon = L.divIcon({
                className: 'custom-div-icon',
                html: `<div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"><span style="margin: auto">${initials}</span></div>`,
                iconSize: [30, 30], iconAnchor: [15, 15]
            });
            
            const timestamp = (loc.lastUpdated && typeof loc.lastUpdated.toDate === 'function') ? new Date(loc.lastUpdated.toDate()).toLocaleTimeString() : '...';
            
            const marker = L.marker([loc.lat, loc.lng], { icon: customIcon }).addTo(map);
            
            if (isMe) {
                // Just show a small popup for your own location
                marker.bindPopup(`<div class="p-1"><b class="text-slate-800">You</b><br><span class="text-[10px] text-slate-400">Last updated: ${timestamp}</span></div>`);
            } else {
                // Instantly open Google Maps when clicking the partner's marker
                marker.on('click', () => {
                    const gMapsUrl = `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`;
                    window.open(gMapsUrl, '_blank');
                });
            }
            
            markers[loc.username] = marker;
            bounds.push([loc.lat, loc.lng]);
        });
        
        if (bounds.length > 0 && activeTab === 'tab-map') {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
        }
    }, error => {
        console.error("Firebase Location Listener Error: ", error);
        alert("Could not load live map data. Check your connection!");
    });
}

function updateScheduleHeader() {
    $('schedule-date').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

initApp();
