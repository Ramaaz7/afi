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
let storage;
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
        storage = null;
    } else {
        const app = firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        storage = firebase.storage();
    }
} catch (err) {
    console.error("Firebase init error:", err);
}

// State & State Management
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || JSON.parse(sessionStorage.getItem('currentUser')) || null;
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
    
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
    
    lucide.createIcons();
    setupEventListeners();
    
    // Ongoing status ping
    if (currentUser && !listeners.statusPing) {
        updateMyStatus();
        listeners.statusPing = setInterval(updateMyStatus, 30000); // 30s ping
    }
}

async function updateMyStatus(isTyping = false) {
    if (!currentUser || firebaseConfig.apiKey === "YOUR_API_KEY") return;
    try {
        await db.collection('users').doc(currentUser.username).update({
            lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
            isTyping: isTyping
        });
    } catch(e) {}
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
    
    const partnerName = currentUser.username === 'afra' ? 'Ramaaz' : 'Afra';
    $('partner-name-display').textContent = partnerName;
    
    if ($('display-name-input')) $('display-name-input').value = currentUser.displayName || currentUser.username;
    if ($('username-id-input')) $('username-id-input').value = currentUser.username;
    if ($('custom-avatar-url')) $('custom-avatar-url').value = currentUser.avatarUrl || '';
    if ($('profile-preview')) $('profile-preview').src = currentUser.avatarUrl || `https://ui-avatars.com/api/?name=${currentUser.username}&background=6366f1&color=fff&size=128`;
    
    if(currentUser.wallpaperUrl) applyWallpaper(currentUser.wallpaperUrl);
    
    switchTab(activeTab);
    updateScheduleHeader();
    initPeerJS();
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
            if ($('remember-me') && $('remember-me').checked) {
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                sessionStorage.removeItem('currentUser');
            } else {
                sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
                localStorage.removeItem('currentUser');
            }
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
        sessionStorage.removeItem('currentUser');
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
        const text = $('checklist-input').value.trim();
        if (text) {
            await db.collection('checklist').add({
                text: text,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                ramaaz: { status: 'none', lastUpdated: null },
                afra: { status: 'none', lastUpdated: null }
            });
            $('checklist-input').value = '';
        }
    });

    $('chat-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = $('chat-input').value.trim();
        const editId = $('edit-message-id').value;
        
        if (text) {
            try {
                if (editId) {
                    await db.collection('messages').doc(editId).update({ text, edited: true });
                    window.cancelEdit();
                } else {
                    const msg = {
                        sender: currentUser.username,
                        text,
                        read: false,
                        timestamp: firebase.firestore ? firebase.firestore.FieldValue.serverTimestamp() : new Date()
                    };
                    if (window.replyingToMsg) {
                        msg.replyTo = window.replyingToMsg;
                        window.cancelReply();
                    }
                    await db.collection('messages').add(msg);
                }
                updateMyStatus(false);
            } catch (err) {
                console.error("Chat send error:", err);
            }
            if(!editId) $('chat-input').value = '';
        }
    });

    window.startEdit = (id, text) => {
        $('edit-message-id').value = id;
        $('chat-input').value = text;
        $('chat-input').focus();
        $('cancel-edit-btn').classList.remove('hidden');
    };

    window.cancelEdit = () => {
        $('edit-message-id').value = '';
        $('chat-input').value = '';
        $('cancel-edit-btn').classList.add('hidden');
    };

    window.replyingToMsg = null;
    window.startReply = (id, text, sender) => {
        window.replyingToMsg = { id, text, sender };
        $('reply-preview-name').textContent = sender === currentUser.username ? 'You' : sender;
        $('reply-preview-text').textContent = text;
        $('reply-preview').classList.remove('hidden');
        $('chat-input').focus();
    };

    window.cancelReply = () => {
        window.replyingToMsg = null;
        $('reply-preview').classList.add('hidden');
    };

    let touchStartX = 0;
    let touchStartY = 0;
    $('chat-messages').addEventListener('touchstart', e => {
        if(e.target.closest('.message-bubble')) {
           touchStartX = e.changedTouches[0].clientX;
           touchStartY = e.changedTouches[0].clientY;
        }
    }, {passive:true});

    $('chat-messages').addEventListener('touchend', e => {
        const bubble = e.target.closest('.message-bubble');
        if(!bubble) return;
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        
        const diffX = endX - touchStartX;
        if (diffX > 60 && Math.abs(endY - touchStartY) < 40) { 
            const id = bubble.getAttribute('data-id');
            const text = bubble.getAttribute('data-text');
            const sender = bubble.getAttribute('data-sender');
            if(id && text && sender) window.startReply(id, decodeURIComponent(text), sender);
        }
    });

    // Quick Emoji Picker
    const quickEmojis = ['😂', '❤️', '😍', '🙏', '😭', '😊', '🥰', '👍', '🔥', '🤔', '👀', '🥺', '🎉', '✨', '💀', '💯', '😎', '😅'];
    const emojiMenu = $('chat-emoji-menu');
    
    quickEmojis.forEach(emoji => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg text-lg transition-transform hover:scale-125';
        btn.textContent = emoji;
        btn.onclick = () => {
            const input = $('chat-input');
            const start = input.selectionStart || input.value.length;
            const end = input.selectionEnd || input.value.length;
            input.value = input.value.substring(0, start) + emoji + input.value.substring(end);
            input.selectionStart = input.selectionEnd = start + emoji.length;
            input.focus();
        };
        emojiMenu.appendChild(btn);
    });

    $('chat-emoji-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        emojiMenu.classList.toggle('hidden');
        if (!emojiMenu.classList.contains('hidden')) {
            emojiMenu.classList.add('grid');
        } else {
            emojiMenu.classList.remove('grid');
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#chat-emoji-menu') && !e.target.closest('#chat-emoji-btn')) {
            emojiMenu.classList.add('hidden');
            emojiMenu.classList.remove('grid');
        }
    });

    // Voice Record Listening
    let mediaRecorder;
    let audioChunks = [];

    $('voice-record-btn').addEventListener('click', async () => {
        if (!storage) return alert("Storage not configured.");
        
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            $('voice-record-btn').classList.remove('bg-red-500', 'text-white', 'animate-pulse');
            $('voice-record-btn').classList.add('bg-slate-50', 'text-slate-400');
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                mediaRecorder.start();
                audioChunks = [];
                
                $('voice-record-btn').classList.remove('bg-slate-50', 'text-slate-400');
                $('voice-record-btn').classList.add('bg-red-500', 'text-white', 'animate-pulse');
                
                mediaRecorder.addEventListener("dataavailable", event => {
                    audioChunks.push(event.data);
                });
                mediaRecorder.addEventListener("stop", async () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    stream.getTracks().forEach(t => t.stop());
                    
                    try {
                        const url = await new Promise((resolve, reject) => {
                            const ref = storage.ref(`chat_media/${Date.now()}_${currentUser.username}.webm`);
                            ref.put(audioBlob).then(() => {
                                ref.getDownloadURL().then(resolve).catch(reject);
                            }).catch(reject);
                        });
                        
                        await db.collection('messages').add({
                            sender: currentUser.username,
                            mediaUrl: url,
                            mediaType: 'audio',
                            read: false,
                            timestamp: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        updateMyStatus(false);
                    } catch(err) {
                        console.error("Audio upload error:", err);
                        alert("Audio upload failed.");
                    }
                });
            } catch(e) { 
                console.error(e);
                alert("Microphone access denied or unavailable."); 
            }
        }
    });

    // Media Upload Listeners
    $('attach-media-btn').addEventListener('click', () => $('chat-media-input').click());
    
    $('chat-media-input').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!storage) { alert("Firebase Storage not configured."); return; }
        if (file.size > 20 * 1024 * 1024) { alert("File is too large! Maximum limit is 20MB."); return; }
        
        $('send-icon').classList.add('hidden');
        $('upload-spinner').classList.remove('hidden');
        $('attach-media-btn').disabled = true;
        
        try {
            const ext = file.name.split('.').pop() || 'tmp';
            const storageRef = storage.ref(`chat_media/${Date.now()}_${currentUser.username}.${ext}`);
            await storageRef.put(file);
            const url = await storageRef.getDownloadURL();
            
            const isVideo = file.type.startsWith('video/');
            const msg = {
                sender: currentUser.username,
                text: isVideo ? '[Video]' : '[Image]',
                mediaUrl: url,
                mediaType: isVideo ? 'video' : 'image',
                read: false,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await db.collection('messages').add(msg);
            updateMyStatus(false);
        } catch (err) {
            console.error("Upload Error:", err);
            alert("Upload failed. Make sure your Firebase Storage rules allow test-mode uploads.");
        }
        
        $('send-icon').classList.remove('hidden');
        $('upload-spinner').classList.add('hidden');
        $('attach-media-btn').disabled = false;
        $('chat-media-input').value = '';
        lucide.createIcons();
    });

    let typingTimeout = null;
    $('chat-input').addEventListener('input', () => {
        updateMyStatus(true);
        if (typingTimeout) clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => { updateMyStatus(false); }, 3000);
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

    // Close reaction picker when clicking outside
    document.addEventListener('click', (e) => {
        const picker = $('reaction-picker');
        if (picker && !picker.classList.contains('hidden') && !picker.contains(e.target)) {
            picker.classList.add('hidden');
            currentReactingMsgId = null;
        }
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
        
        if (sessionStorage.getItem('currentUser')) {
            sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
        } else {
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
        }
        alert('Profile updated successfully!');
        showApp();
    });

    $('avatar-file-input').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file || !storage) return;
        
        $('profile-preview').style.opacity = '0.4';
        
        try {
            const ext = file.name.split('.').pop() || 'tmp';
            const storageRef = storage.ref(`avatars/${currentUser.username}_${Date.now()}.${ext}`);
            await storageRef.put(file);
            const url = await storageRef.getDownloadURL();
            
            $('profile-preview').src = url;
            $('custom-avatar-url').value = url;
            $('profile-preview').style.opacity = '1';
        } catch(err) {
            console.error("Avatar Upload Error: ", err);
            alert("Failed to upload profile picture. Ensure the image is valid.");
            $('profile-preview').style.opacity = '1';
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
        case 'tab-chat': 
            setupChatListener(); 
            unreadChatCount = 0;
            if ($('chat-badge')) $('chat-badge').classList.add('hidden');
            break;
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
    
    // Auto refresh timer to update lock UI countdowns
    if (listeners.checklistTimer) clearInterval(listeners.checklistTimer);
    listeners.checklistTimer = setInterval(() => {
        if (activeTab === 'tab-checklist' && document.getElementById('checklist-items')) {
            lucide.createIcons(); // Simply running a UI pass, though proper react-like state would re-render.
            // Let's force a re-render of the list if needed by storing the data:
            if(window.lastChecklistSnapshot) renderChecklistUI(window.lastChecklistSnapshot);
        }
    }, 60000);

    listeners.checklist = db.collection('checklist').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        window.lastChecklistSnapshot = snapshot;
        renderChecklistUI(snapshot);
    });
}

function renderChecklistUI(snapshot) {
    const container = $('checklist-items');
    if (!container) return;
    container.innerHTML = '';
    
    if (snapshot.empty) {
        container.innerHTML = `<div class="text-center py-8 text-slate-400"><i data-lucide="clipboard-list" class="w-12 h-12 mx-auto mb-2 opacity-50"></i><p>No items yet. Add a new goal!</p></div>`;
        lucide.createIcons();
        return;
    }
    
    snapshot.forEach(doc => {
        const item = { id: doc.id, ...doc.data() };
        const div = document.createElement('div');
        div.className = "flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl mb-3 shadow-sm transition-all hover:border-indigo-100";
        
        const renderUserCol = (userKey, displayName) => {
            const state = item[userKey] || { status: 'none', lastUpdated: null };
            let isLocked = false;
            let timeStr = '';
            
            if (state.lastUpdated) {
                const elapsedMs = Date.now() - state.lastUpdated;
                if (elapsedMs < 12 * 60 * 60 * 1000) {
                    isLocked = true;
                    const timeLeft = Math.ceil((12 * 60 * 60 * 1000 - elapsedMs) / (60 * 1000));
                    const hours = Math.floor(timeLeft / 60);
                    const mins = timeLeft % 60;
                    timeStr = `${hours}h ${mins}m`;
                }
            }
            
            let buttonsHtml = '';
            if (isLocked) {
                if (state.status === 'right') {
                    buttonsHtml = `
                        <div class="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center shadow-md"><i data-lucide="check" class="w-5 h-5"></i></div>
                        <div class="text-[9px] text-slate-400 mt-1.5 font-bold whitespace-nowrap flex items-center justify-center gap-0.5"><i data-lucide="lock" class="w-2.5 h-2.5"></i> ${timeStr}</div>`;
                } else if (state.status === 'wrong') {
                    buttonsHtml = `
                        <div class="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md"><i data-lucide="x" class="w-5 h-5"></i></div>
                        <div class="text-[9px] text-slate-400 mt-1.5 font-bold whitespace-nowrap flex items-center justify-center gap-0.5"><i data-lucide="lock" class="w-2.5 h-2.5"></i> ${timeStr}</div>`;
                }
            } else {
                const disabledStr = (currentUser.username === userKey) ? '' : 'disabled class="opacity-30 cursor-not-allowed"';
                const activeClass = (currentUser.username === userKey) ? 'hover:scale-110 active:scale-95' : '';
                buttonsHtml = `
                    <div class="flex gap-1.5">
                        <button class="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 hover:bg-green-500 hover:border-green-500 hover:text-white transition-all text-slate-400 flex items-center justify-center shadow-sm ${activeClass}" onclick="updateChecklist('${item.id}', '${userKey}', 'right')" ${disabledStr}>
                            <i data-lucide="check" class="w-5 h-5"></i>
                        </button>
                        <button class="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 hover:bg-red-500 hover:border-red-500 hover:text-white transition-all text-slate-400 flex items-center justify-center shadow-sm ${activeClass}" onclick="updateChecklist('${item.id}', '${userKey}', 'wrong')" ${disabledStr}>
                            <i data-lucide="x" class="w-5 h-5"></i>
                        </button>
                    </div>
                `;
            }
            
            return `
                <div class="flex flex-col items-center flex-1">
                    <span class="text-[10px] uppercase font-bold text-slate-400 block mb-2 tracking-wider">${displayName}</span>
                    <div class="flex flex-col justify-center items-center h-10 w-full">
                        ${buttonsHtml}
                    </div>
                </div>
            `;
        };
        
        div.innerHTML = `
            <div class="flex-1 pr-4 max-w-[45%]">
                <p class="font-bold text-slate-700 text-sm leading-tight break-words">${escapeHtml(item.text || item.item || '')}</p>
                <button class="text-[10px] text-slate-400 hover:text-red-500 mt-2.5 flex items-center gap-1 font-bold uppercase transition-colors group" onclick="deleteChecklistItem('${item.id}')">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5 group-hover:scale-110 transition-transform"></i> Delete
                </button>
            </div>
            <div class="flex gap-2 items-start opacity-90 border-l border-slate-100 pl-4 py-1 flex-1 justify-around bg-slate-50/50 rounded-r-xl -my-4 h-full">
                ${renderUserCol('ramaaz', 'Ramaaz')}
                <div class="w-px h-12 bg-slate-200 self-center"></div>
                ${renderUserCol('afra', 'Afra')}
            </div>
        `;
        container.appendChild(div);
    });
    
    lucide.createIcons();
}

window.updateChecklist = async (id, userKey, status) => {
    if (currentUser.username !== userKey) {
        alert("You can only check off your own column!");
        return;
    }
    try {
        await db.collection('checklist').doc(id).update({
            [userKey]: {
                status: status,
                lastUpdated: Date.now()
            }
        });
    } catch(err) { console.error(err); }
};

window.deleteChecklistItem = async id => {
    if (confirm("Delete this mutual goal permanently?")) {
        await db.collection('checklist').doc(id).delete();
    }
};

let chatUserDataCache = {};
let unreadChatCount = 0;
let initialChatLoad = true;

function setupChatListener() {
    if (listeners.chat) listeners.chat();
    initialChatLoad = true;

    if (firebaseConfig.apiKey === "YOUR_API_KEY") {
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
        if (Object.keys(chatUserDataCache).length === 0) {
            try {
                const userDocs = await db.collection('users').get();
                userDocs.forEach(doc => { chatUserDataCache[doc.id] = doc.data(); });
            } catch (e) {}
        }
        
        // Handle new message notifications
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const msg = change.doc.data();
                if (!initialChatLoad && msg.sender !== currentUser.username) {
                    if (Notification.permission === 'granted' && (document.hidden || activeTab !== 'tab-chat')) {
                        const senderName = chatUserDataCache[msg.sender]?.displayName || msg.sender;
                        new Notification(`New message from ${senderName}`, { body: msg.text, icon: chatUserDataCache[msg.sender]?.avatarUrl });
                    }
                    if (activeTab !== 'tab-chat') {
                        unreadChatCount++;
                        const badge = $('chat-badge');
                        if (badge) {
                            badge.textContent = unreadChatCount > 9 ? '9+' : unreadChatCount;
                            badge.classList.remove('hidden');
                        }
                    }
                }
            }
        });
        
        initialChatLoad = false;
        
        const msgs = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            // WhatsApp-style: Mark read immediately if chat is open!
            if (data.sender !== currentUser.username && !data.read && activeTab === 'tab-chat' && !document.hidden) {
                doc.ref.update({ read: true }).catch(()=>{});
            }
            msgs.push({ id: doc.id, ...data });
        });
        
        renderChatMessages(msgs);
    });
    
    // Partner's Status listener (Last seen / Typing)
    if (!listeners.partnerStatus) {
        const partnerId = currentUser.username === 'afra' ? 'ramaaz' : 'afra';
        listeners.partnerStatus = db.collection('users').doc(partnerId).onSnapshot(doc => {
            if (doc.exists) {
                const d = doc.data();
                $('chat-partner-name').textContent = d.displayName || partnerId;
                
                // Typing detection
                if (d.isTyping) {
                    $('typing-indicator').classList.remove('hidden');
                    $('typing-text').textContent = (d.displayName || partnerId) + " is typing";
                } else {
                    $('typing-indicator').classList.add('hidden');
                }
                
                // Online/Last Seen computation
                const now = new Date();
                let isOnline = false;
                
                if (d.lastSeen && typeof d.lastSeen.toDate === 'function') {
                    const lastSeenTime = d.lastSeen.toDate();
                    const secondsAgo = Math.floor((now - lastSeenTime) / 1000);
                    if (secondsAgo < 60) {
                        isOnline = true;
                    }
                }
                
                $('online-status-text').textContent = isOnline ? "Online" : "Offline";
                $('online-status-dot').className = `w-2 h-2 rounded-full transition-colors ${isOnline ? 'bg-green-500' : 'bg-red-500'}`;
            }
        });
    }
}

function renderChatMessages(msgs) {
    const container = $('chat-messages');
    container.innerHTML = '';

    msgs.forEach(msg => {
        if (!msg.text) return;

        let timeString = '';
        if (msg.timestamp) {
            try {
                const date = typeof msg.timestamp.toDate === 'function' ? msg.timestamp.toDate() : new Date(msg.timestamp);
                const now = new Date();
                const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                
                const timePart = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                if (isToday) {
                    timeString = timePart;
                } else {
                    const datePart = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                    timeString = `${datePart}, ${timePart}`;
                }
            } catch(e) {
                timeString = '';
            }
        }

        const isMine = msg.sender === currentUser.username;
        const senderProfile = chatUserDataCache[msg.sender] || { displayName: msg.sender };
        const avatar = senderProfile.avatarUrl || `https://ui-avatars.com/api/?name=${msg.sender}&background=6366f1&color=fff`;

        const div = document.createElement('div');
        div.className = `fade-in flex items-end gap-2 group ${isMine ? 'flex-row-reverse' : 'flex-row'} mb-2`;

        let contentHtml = '';
        if (msg.mediaUrl) {
            if (msg.mediaType === 'video') {
                contentHtml += `<video src="${msg.mediaUrl}" controls class="max-w-[180px] md:max-w-[220px] rounded-lg mt-1 mb-1 object-cover bg-black/10"></video>`;
            } else if (msg.mediaType === 'audio') {
                contentHtml += `<audio src="${msg.mediaUrl}" controls class="h-10 mt-1 mb-1 max-w-[200px]" controlsList="nodownload"></audio>`;
            } else {
                contentHtml += `<a href="${msg.mediaUrl}" target="_blank"><img src="${msg.mediaUrl}" class="max-w-[180px] md:max-w-[220px] rounded-lg mt-1 mb-1 object-cover border border-black/5"></a>`;
            }
        }
        
        if (msg.text && msg.text !== '[Image]' && msg.text !== '[Video]') {
            contentHtml += `<div class="${msg.mediaUrl ? 'mt-2' : ''} break-words whitespace-pre-wrap">${escapeHtml(msg.text)}</div>`;
        }
        
        if (msg.replyTo) {
            const replySender = msg.replyTo.sender === currentUser.username ? 'You' : msg.replyTo.sender;
            contentHtml = `
                <div class="mb-1.5 px-3 py-1.5 bg-black/10 rounded-lg border-l-[3px] ${isMine ? 'border-indigo-300' : 'border-slate-400'} text-[11px] opacity-90 cursor-pointer overflow-hidden">
                    <strong class="${isMine ? 'text-indigo-100' : 'text-slate-600'} block mb-0.5 leading-none">${replySender}</strong>
                    <div class="truncate max-w-[150px] md:max-w-[200px] text-ellipsis whitespace-nowrap overflow-hidden">${escapeHtml(msg.replyTo.text)}</div>
                </div>
            ` + contentHtml;
        }

        // Reactions logic
        let reactionsHtml = '';
        if (msg.reactions && Object.keys(msg.reactions).length > 0) {
            const rMap = {};
            Object.values(msg.reactions).forEach(e => { rMap[e] = (rMap[e] || 0) + 1 });
            let emojiList = Object.keys(rMap).join('');
            const total = Object.values(rMap).reduce((a, b) => a + b, 0);
            
            reactionsHtml = `
                <div class="absolute -bottom-2.5 ${isMine ? 'right-2' : 'left-8'} bg-slate-50 text-[12px] px-1.5 py-[2px] rounded-full shadow-[0_2px_8px_-2px_rgba(0,0,0,0.15)] border border-slate-200 flex items-center gap-0.5 z-10 cursor-pointer hover:bg-slate-100 transition-colors" onclick="openReactionPicker(event, '${msg.id}')">
                    <span class="emoji-text leading-none">${emojiList}</span>
                    ${total > 1 ? `<span class="text-slate-500 ml-0.5 text-[opacity-80] font-bold leading-none pr-0.5">${total}</span>` : ''}
                </div>
            `;
        }

        if (isMine) {
            const checkmarks = msg.read ? '✓✓' : '✓';
            const checkColor = msg.read ? 'text-indigo-200' : 'text-indigo-200/60';
            const editedTag = msg.edited ? `<span class="text-[9.5px] text-white/60 italic font-medium leading-none mr-1">edited</span>` : '';
            
            div.innerHTML = `
                <div class="flex items-center gap-1.5 opacity-0 md:opacity-0 self-center transition-all group-hover:opacity-100 hidden md:flex">
                    <button type="button" onclick="startReply('${msg.id}', decodeURIComponent('${encodeURIComponent(msg.text || '[Media]')}'), '${msg.sender}')" class="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100" title="Reply">
                        <i data-lucide="reply" class="w-4 h-4"></i>
                    </button>
                    <button type="button" onclick="startEdit('${msg.id}', decodeURIComponent('${encodeURIComponent(msg.text || '')}'))" class="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100" title="Edit message">
                        <i data-lucide="pencil" class="w-4 h-4"></i>
                    </button>
                    <button type="button" onclick="openReactionPicker(event, '${msg.id}')" class="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100" title="React">
                        <i data-lucide="smile-plus" class="w-4 h-4"></i>
                    </button>
                </div>
                <div class="flex flex-col items-end w-full relative">
                    <div class="message-bubble mine px-4 py-2 pt-2.5 shadow-sm text-sm relative" style="min-width: 65px;" data-id="${msg.id}" data-text="${encodeURIComponent(msg.text || '[Media]')}" data-sender="${msg.sender}" ondblclick="reactToMessageInline('${msg.id}', '❤️')">
                        ${contentHtml}
                        <div class="flex items-center justify-end mt-1.5 gap-1.5 leading-none tracking-tighter" title="${msg.read ? 'Seen' : 'Delivered'}">
                            ${editedTag}
                            <span class="text-[9px] text-indigo-200/80 font-medium">${timeString}</span>
                            <div class="text-[11px] font-bold ${checkColor}">${checkmarks}</div>
                        </div>
                        ${reactionsHtml}
                    </div>
                </div>
            `;
        } else {
            const editedTag = msg.edited ? `<span class="text-[9.5px] text-slate-400 italic font-medium leading-none ml-1">edited</span>` : '';
            div.innerHTML = `
                <img src="${avatar}" onclick="viewProfile('${msg.sender}')" class="w-7 h-7 rounded-full object-cover flex-shrink-0 self-end mb-1 border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity">
                <div class="flex flex-col items-start max-w-[75%] relative">
                    <div class="message-bubble theirs px-4 py-2.5 shadow-sm text-sm relative" data-id="${msg.id}" data-text="${encodeURIComponent(msg.text || '[Media]')}" data-sender="${msg.sender}" ondblclick="reactToMessageInline('${msg.id}', '❤️')">
                        ${contentHtml}
                        <div class="flex items-center justify-end mt-1.5 gap-1.5 leading-none tracking-tighter">
                            ${msg.edited ? editedTag : ''}
                            <span class="text-[9px] text-slate-400 font-medium">${timeString}</span>
                        </div>
                        ${reactionsHtml}
                    </div>
                </div>
                <div class="opacity-0 md:opacity-0 self-center transition-all group-hover:opacity-100 hidden md:flex items-center gap-1.5">
                    <button type="button" onclick="openReactionPicker(event, '${msg.id}')" class="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100" title="React">
                        <i data-lucide="smile-plus" class="w-4 h-4"></i>
                    </button>
                    <button type="button" onclick="startReply('${msg.id}', decodeURIComponent('${encodeURIComponent(msg.text || '[Media]')}'), '${msg.sender}')" class="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100" title="Reply">
                        <i data-lucide="reply" class="w-4 h-4"></i>
                    </button>
                </div>
            `;
        }
        container.appendChild(div);
    });
    
    container.scrollTop = container.scrollHeight;
    lucide.createIcons();
}

// Helper to escape basic HTML symbols to prevent XSS
function escapeHtml(unsafe) {
    return (unsafe || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

window.viewProfile = async (username) => {
    const profile = chatUserDataCache[username] || { displayName: username, avatarUrl: `https://ui-avatars.com/api/?name=${username}&background=6366f1&color=fff`, isOnline: false };
    $('modal-profile-img').src = profile.avatarUrl;
    $('modal-profile-name').textContent = profile.displayName || username;
    $('modal-profile-username').textContent = '@' + username;
    
    if ($('modal-profile-status')) {
        $('modal-profile-status').innerHTML = `<span class="w-2 h-2 rounded-full ${profile.isOnline ? 'bg-green-500' : 'bg-slate-400'}"></span> ${profile.isOnline ? 'Online' : 'Offline'}`;
        $('modal-profile-status').classList.remove('hidden');
    }

    if ($('modal-location-btn')) {
        $('modal-location-btn').classList.add('hidden');
        $('modal-location-btn').innerHTML = `<i data-lucide="map-pin" class="w-5 h-5 animate-pulse"></i> <span>Locating...</span>`;
    }
    
    $('profile-modal').classList.remove('hidden');
    lucide.createIcons();
    
    try {
        const locDoc = await db.collection('locations').doc(username).get();
        if (locDoc.exists && $('modal-location-btn')) {
            const data = locDoc.data();
            if (data && data.lat && data.lng) {
                $('modal-location-btn').href = `https://www.google.com/maps/search/?api=1&query=${data.lat},${data.lng}`;
                $('modal-location-btn').classList.remove('hidden');
                
                if (data.lastUpdated) {
                    const time = typeof data.lastUpdated.toDate === 'function' ? data.lastUpdated.toDate() : new Date();
                    const diffMins = Math.floor((new Date() - time) / 60000);
                    let timeText = diffMins < 1 ? 'Just now' : diffMins >= 60 ? Math.floor(diffMins/60) + 'h ago' : `${diffMins}m ago`;
                    $('modal-location-btn').innerHTML = `<i data-lucide="map-pin" class="w-5 h-5"></i> <span class="tracking-tight">Target Location \xb7 ${timeText}</span>`;
                } else {
                    $('modal-location-btn').innerHTML = `<i data-lucide="map-pin" class="w-5 h-5"></i> <span>View Target Location</span>`;
                }
                lucide.createIcons();
            }
        }
    } catch(e) {
        console.error("Location lookup error: ", e);
    }
};

let currentReactingMsgId = null;

window.openReactionPicker = (e, msgId) => {
    currentReactingMsgId = msgId;
    const picker = $('reaction-picker');
    picker.classList.remove('hidden');
    
    const rect = e.currentTarget.getBoundingClientRect();
    const pickerWidth = 220; 
    
    let left = rect.left - (pickerWidth / 2) + 12;
    if (left < 10) left = 10;
    if (left + pickerWidth > window.innerWidth) left = window.innerWidth - pickerWidth - 10;
    
    let top = rect.top - 60;
    if (top < 10) top = rect.bottom + 10;
    
    picker.style.top = top + 'px';
    picker.style.left = left + 'px';
    e.stopPropagation();
};

window.reactToMessageInline = async (msgId, emoji) => {
    if (firebaseConfig.apiKey === "YOUR_API_KEY") return;
    try {
        await db.collection('messages').doc(msgId).set({ reactions: { [currentUser.username]: emoji } }, { merge: true });
    } catch(e) {}
};

window.reactToMessage = async (emoji) => {
    if (!currentReactingMsgId) return;
    try {
        await db.collection('messages').doc(currentReactingMsgId).set({ reactions: { [currentUser.username]: emoji } }, { merge: true });
    } catch(e) {}
    $('reaction-picker').classList.add('hidden');
    currentReactingMsgId = null;
};

window.promptMoreEmoji = async () => {
    $('reaction-picker').classList.add('hidden');
    setTimeout(async () => {
        const custom = prompt("Send an emoji from your keyboard:");
        if (custom && custom.trim().length > 0) {
            const emojiStr = custom.trim().substring(0, 5); 
            if (currentReactingMsgId) {
                try {
                    await db.collection('messages').doc(currentReactingMsgId).set({ reactions: { [currentUser.username]: emojiStr } }, { merge: true });
                } catch(e) {}
            }
        }
        currentReactingMsgId = null;
    }, 50);
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

let myLocationWatcher = null;

window.requestMapPermission = () => {
    if ($('map-permission-overlay')) $('map-permission-overlay').classList.add('hidden');
    
    if (firebaseConfig.apiKey === "YOUR_API_KEY") return;
    
    if ("geolocation" in navigator) {
        if (!myLocationWatcher) {
            
            if ('wakeLock' in navigator) {
                navigator.wakeLock.request('screen').catch(()=>{});
                document.addEventListener('visibilitychange', () => {
                   if (document.visibilityState === 'visible') navigator.wakeLock.request('screen').catch(()=>{});
                });
            }

            const updateLoc = async (position) => {
                const { latitude, longitude } = position.coords;
                if ($('enable-location-btn')) {
                    const btn = $('enable-location-btn');
                    btn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
                    btn.classList.add('bg-green-500', 'hover:bg-green-600');
                    btn.innerHTML = `<i data-lucide="check-circle-2" class="w-4 h-4"></i><span>Sharing</span>`;
                    lucide.createIcons();
                }
                try {
                    await db.collection('locations').doc(currentUser.username).set({
                        username: currentUser.username,
                        lat: latitude,
                        lng: longitude,
                        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                    });
                } catch(e) {}
            };

            const locError = (err) => {
                console.error("Location error:", err);
                if ($('map-permission-overlay')) {
                    $('map-permission-overlay').classList.remove('hidden');
                    if (err.code === 1) {
                        $('map-permission-overlay').querySelector('p').innerHTML = "<b>Permission Blocked</b><br>App needs Map permission. Reset your browser settings (look for the lock icon) to allow tracking.";
                    } else {
                        $('map-permission-overlay').querySelector('p').innerHTML = "<b>GPS Error</b><br>Cannot find your coordinates. Ensure device location is on.";
                    }
                }
            };

            navigator.geolocation.getCurrentPosition(updateLoc, locError, { enableHighAccuracy: true, timeout: 10000 });
            myLocationWatcher = navigator.geolocation.watchPosition(updateLoc, locError, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
        }
    } else {
        alert("Your browser does not support geolocation tracking.");
    }
};

function setupLocationListener() {
    // Attempt tracking
    requestMapPermission();
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

// --- Calls System (PeerJS) ---
let peer;
let currentCall;
let localMediaStream;

function initPeerJS() {
    if (peer || !currentUser || typeof Peer === 'undefined') return;
    
    const myId = 'afi_routine_' + currentUser.username.replace(/[^a-zA-Z0-9]/g, '');
    peer = new Peer(myId, { debug: 1 });
    
    peer.on('call', call => {
        const callerName = call.peer.replace('afi_routine_', '');
        const isVideo = call.metadata && call.metadata.isVideo;
        const confirmMsg = `${callerName} is giving you a ${isVideo ? 'Video' : 'Voice'} Call! Accept?`;
        
        if (confirm(confirmMsg)) {
            navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo }).then(stream => {
                localMediaStream = stream;
                call.answer(stream);
                handleCallStream(call, isVideo);
            }).catch(e => {
                alert("Permission required for calls.");
                call.close();
            });
        } else {
            call.close();
        }
    });
}

const startCall = (isVideo) => {
    const partner = Object.keys(chatUserDataCache).find(u => u !== currentUser.username);
    if (!partner) return alert("We haven't detected your partner yet. Try again when they are online.");
    
    $('call-title').textContent = isVideo ? 'Video Call' : 'Voice Call';
    $('call-status-text').textContent = 'Calling...';
    $('call-icon').classList.toggle('hidden', isVideo);
    $('call-overlay').classList.remove('hidden');
    $('remote-video').classList.toggle('hidden', !isVideo);
    $('local-video').classList.toggle('hidden', !isVideo);
    
    navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo }).then(stream => {
        localMediaStream = stream;
        
        if (isVideo) {
            $('local-video').srcObject = stream;
        }
        
        const partnerId = 'afi_routine_' + partner.replace(/[^a-zA-Z0-9]/g, '');
        const call = peer.call(partnerId, stream, { metadata: { isVideo } });
        handleCallStream(call, isVideo);
    }).catch(err => {
        console.error(err);
        alert("Camera/Microphone required to make calls.");
        $('call-overlay').classList.add('hidden');
    });
};

if ($('start-call-btn')) $('start-call-btn').addEventListener('click', () => startCall(false));
if ($('start-video-btn')) $('start-video-btn').addEventListener('click', () => startCall(true));

$('end-call-btn').addEventListener('click', endCall);

function handleCallStream(call, isVideo) {
    currentCall = call;
    $('call-title').textContent = isVideo ? 'Video Call' : 'Voice Call';
    $('call-status-text').textContent = 'Call Connected';
    $('call-overlay').classList.remove('hidden');
    $('call-icon').classList.toggle('hidden', isVideo);
    
    if (isVideo && localMediaStream) {
        $('local-video').srcObject = localMediaStream;
        $('local-video').classList.remove('hidden');
    }
    
    call.on('stream', remoteStream => {
        if (isVideo) {
            $('remote-video').srcObject = remoteStream;
            $('remote-video').classList.remove('hidden');
        } else {
            let audioEl = document.getElementById('remote-audio-player');
            if (!audioEl) {
                audioEl = document.createElement('audio');
                audioEl.id = 'remote-audio-player';
                audioEl.autoplay = true;
                document.body.appendChild(audioEl);
            }
            audioEl.srcObject = remoteStream;
        }
    });
    
    call.on('close', endCall);
    call.on('error', endCall);
}

function endCall() {
    if (currentCall) currentCall.close();
    currentCall = null;
    
    if (localMediaStream) {
        localMediaStream.getTracks().forEach(t => t.stop());
        localMediaStream = null;
    }
    
    if ($('remote-video')) $('remote-video').srcObject = null;
    if ($('local-video')) $('local-video').srcObject = null;
    if ($('call-overlay')) $('call-overlay').classList.add('hidden');
}

// --- Wallpaper Settings ---
function applyWallpaper(url) {
    if (!$('chat-messages')) return;
    if (url) {
        $('chat-messages').style.backgroundImage = `url(${url})`;
        $('chat-messages').style.backgroundSize = 'cover';
        $('chat-messages').style.backgroundPosition = 'center';
        $('chat-messages').style.backgroundAttachment = 'fixed';
        $('chat-messages').classList.remove('bg-slate-50/50');
        if ($('remove-wallpaper-btn')) $('remove-wallpaper-btn').classList.remove('hidden');
    } else {
        $('chat-messages').style.backgroundImage = '';
        $('chat-messages').classList.add('bg-slate-50/50');
        if ($('remove-wallpaper-btn')) $('remove-wallpaper-btn').classList.add('hidden');
    }
}

if ($('wallpaper-upload')) {
    $('wallpaper-upload').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file || !storage) return;
        
        try {
            const btn = e.target.previousElementSibling.previousElementSibling; 
            const originalHtml = btn.innerHTML;
            btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>`;
            lucide.createIcons();
            
            const ref = storage.ref(`wallpapers/${currentUser.username}_${Date.now()}`);
            await ref.put(file);
            const url = await ref.getDownloadURL();
            
            await db.collection('users').doc(currentUser.username).update({
                wallpaperUrl: url
            });
            
            currentUser.wallpaperUrl = url;
            if (sessionStorage.getItem('currentUser')) {
                sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
            } else {
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
            }
            applyWallpaper(url);
            
            btn.innerHTML = originalHtml;
            lucide.createIcons();
        } catch(err) {
            console.error(err);
            alert("Failed to upload wallpaper.");
            const btn = e.target.previousElementSibling.previousElementSibling;
            btn.innerHTML = `<i data-lucide="image" class="w-4 h-4"></i> Upload Wallpaper`;
            lucide.createIcons();
        }
    });
}

window.removeWallpaper = async () => {
    try {
        await db.collection('users').doc(currentUser.username).update({
            wallpaperUrl: firebase.firestore.FieldValue.delete()
        });
        delete currentUser.wallpaperUrl;
        if (sessionStorage.getItem('currentUser')) {
            sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
        } else {
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
        }
        applyWallpaper(null);
    } catch(err) {
        console.error(err);
    }
};

initApp();
