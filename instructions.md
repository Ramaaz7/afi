# Instructions for Couple Planner App Build

Build a full-stack-style local-first web application called **"Couple Planner App"** using a single-page architecture or modular HTML/JS files.

## 1. Technical Stack
- **Frontend:** HTML5, Tailwind CSS (via CDN), Lucide Icons (for UI).
- **Database:** Dexie.js (IndexedDB wrapper) to handle local storage of users, tasks, messages, and locations.
- **Logic:** Vanilla JavaScript (ES6+).
- **Real-time Simulation:** Since this is local-first, use Dexie's observable patterns or simple polling to simulate the "shared" experience between the two local user profiles.

## 2. Database Schema (Dexie.js)
Initialize a database named `CouplePlannerDB` with the following stores:
- `users`: `++id, username, password, role`
- `timetable`: `++id, user, day, time, task, completed`
- `checklist`: `++id, item, status, assignedTo`
- `messages`: `++id, sender, text, timestamp`
- `locations`: `++id, username, lat, lng, lastUpdated`

## 3. Core Features Implementation

### A. Authentication System
- Create a login overlay/page.
- **Hardcoded Credentials (Initialization):**
  - User 1: `afra` | Pass: `afi123`
  - User 2: `ramaaz` | Pass: `afi123`
- **Session:** Store the "logged-in" user in `localStorage` to persist state on refresh.
- **Registration:** A "Create User" form that adds new entries to the `users` store.

### B. Dashboard & Navigation
- Top Navigation bar showing the logged-in user and a "Logout" button.
- A main content area that switches between: **Daily Schedule, Shared Checklist, Chat, and Map.**

### C. Timetable (Daily Schedule)
- Grid layout showing hours (e.g., 08:00 to 22:00).
- Users can click a slot to add a task.
- Each task card must have an "Edit," "Delete," and a "Complete" checkbox.

### D. Shared Checklist
- A global list accessible by all users.
- Features: Add new item, toggle completion, and delete.
- Use a "Shared with [Partner Name]" label at the top.

### E. Chat System
- A messaging interface.
- Display messages in speech bubbles (Left for partner, Right for self).
- Automatically scroll to the bottom when a new message is added to Dexie.

### F. Location Tracking (Leaflet.js Integration)
- Integrate **Leaflet.js** (OpenStreetMap) for the map view.
- **Button:** "Share My Location" - uses `navigator.geolocation` to get coordinates.
- Update the `locations` store with the current user's lat/lng.
- Display markers for both 'afra' and 'ramaaz' on the map simultaneously.

## 4. UI/UX Design Requirements
- **Theme:** Modern Light/Soft mode. Use `slate-50` for backgrounds and `indigo-600` for primary actions.
- **Responsive:** Use Tailwind's `flex-col` on mobile and `flex-row` on desktop.
- **Interactions:** Add `transition-all` to buttons and hover states for list items.

## 5. File Structure Suggestion
- `index.html`: Main structure and Tailwind/Dexie/Leaflet CDN links.
- `app.js`: Database initialization and Auth logic.
- `ui.js`: DOM manipulation for switching tabs and rendering lists.
- `styles.css`: Custom scrollbars and minor tweaks.

## 6. Security & Validation
- Hash passwords using a simple SHA-256 browser subtle crypto (optional for local, but recommended).
- Ensure no empty tasks or messages can be sent.