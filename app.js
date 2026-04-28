import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  onSnapshot, 
  doc, 
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp,
  where
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDzea16zmYlrQIE4GA0SH2lUPIgTEkO9N8",
  authDomain: "tenor-1b4fe.firebaseapp.com",
  projectId: "tenor-1b4fe",
  storageBucket: "tenor-1b4fe.firebasestorage.app",
  messagingSenderId: "886765186948",
  appId: "1:886765186948:web:1f7a4d4148b5488e11b7d1",
  measurementId: "G-0R58SYBWS5"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);
const googleProvider = new GoogleAuthProvider();

let currentUser = null;
let tasks = [];
let reminders = [];
let countdowns = [];
let currentDate = new Date();

// Store unsubscribers for cleanup
let unsubscribers = {
  tasks: null,
  reminders: null,
  countdowns: null
};

// ══════════════════════════════════════════════
//  AUTHENTICATION
// ══════════════════════════════════════════════

// Create loading screen immediately
function createLoadingScreen() {
  if (document.getElementById('loading-screen')) return;
  const loading = document.createElement('div');
  loading.id = 'loading-screen';
  loading.innerHTML = `
    <div class="loading-content">
      <div class="loading-logo">Tenor</div>
      <div class="loading-spinner"></div>
    </div>
  `;
  document.body.appendChild(loading);
  
  const style = document.createElement('style');
  style.id = 'loading-styles';
  style.textContent = `
    #loading-screen {
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      display: flex; align-items: center; justify-content: center;
      z-index: 99999;
      transition: opacity 0.6s ease, transform 0.6s ease;
    }
    #loading-screen.woosh-out { opacity: 0; transform: scale(1.1); }
    .loading-content { text-align: center; }
    .loading-logo {
      font-family: 'Monoton', cursive;
      font-size: 3rem; color: white; margin-bottom: 2rem;
      text-shadow: 0 0 40px rgba(255,255,255,0.3);
      animation: pulse-glow 2s ease-in-out infinite;
    }
    @keyframes pulse-glow {
      0%, 100% { text-shadow: 0 0 40px rgba(255,255,255,0.2); }
      50% { text-shadow: 0 0 60px rgba(255,255,255,0.5); }
    }
    .loading-spinner {
      width: 40px; height: 40px;
      border: 3px solid rgba(255,255,255,0.1);
      border-top-color: rgba(255,255,255,0.8);
      border-radius: 50%; margin: 0 auto;
      animation: spin 1s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);
}

function hideLoadingScreen() {
  const loading = document.getElementById('loading-screen');
  if (loading) {
    loading.classList.add('woosh-out');
    setTimeout(() => {
      loading.remove();
      document.getElementById('loading-styles')?.remove();
    }, 600);
  }
}

function showAuthScreen() {
  if (!document.getElementById('auth-overlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'auth-overlay';
    overlay.innerHTML = `
      <div class="auth-container">
        <div class="auth-logo">Tenor</div>
        <p class="auth-subtitle">Your personal productivity companion</p>
        <button id="google-signin-btn" class="google-signin-btn">
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>
        <p class="auth-note">Sign in to sync your tasks, habits, and countdowns across devices</p>
      </div>
    `;
    document.body.appendChild(overlay);
    
    const style = document.createElement('style');
    style.textContent = `
      #auth-overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        display: flex; align-items: center; justify-content: center;
        z-index: 10000; opacity: 0;
        transition: opacity 0.5s ease; pointer-events: none;
      }
      #auth-overlay.visible { opacity: 1; pointer-events: all; }
      .auth-container {
        text-align: center; padding: 2rem; max-width: 400px; width: 90%;
        transform: translateY(20px); transition: transform 0.5s ease;
      }
      #auth-overlay.visible .auth-container { transform: translateY(0); }
      .auth-logo { font-family: 'Monoton', cursive; font-size: 4rem; color: white; margin-bottom: 1rem; text-shadow: 0 0 40px rgba(255,255,255,0.3); }
      .auth-subtitle { color: rgba(255,255,255,0.6); font-size: 1.1rem; margin-bottom: 3rem; }
      .google-signin-btn {
        display: inline-flex; align-items: center; gap: 12px;
        background: white; color: #333; border: none; padding: 16px 32px;
        border-radius: 50px; font-size: 1rem; font-weight: 500; cursor: pointer;
        transition: all 0.3s ease; box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      }
      .google-signin-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 30px rgba(0,0,0,0.3); }
      .auth-note { color: rgba(255,255,255,0.4); font-size: 0.85rem; margin-top: 2rem; line-height: 1.5; }
    `;
    document.head.appendChild(style);
    document.getElementById('google-signin-btn').addEventListener('click', signInWithGoogle);
  }
  document.getElementById('auth-overlay').classList.add('visible');
}

function hideAuthScreen() {
  const overlay = document.getElementById('auth-overlay');
  if (overlay) {
    overlay.classList.remove('visible');
    setTimeout(() => overlay.remove(), 500);
  }
}

async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    console.log('Signed in as:', result.user.email);
  } catch (error) {
    console.error('Sign-in error:', error);
    alert('Failed to sign in. Please try again.');
  }
}

async function signOutUser() {
  try {
    await signOut(auth);
    console.log('Signed out');
  } catch (error) {
    console.error('Sign-out error:', error);
  }
}

// Listen for auth state changes
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    console.log('User authenticated:', user.email);
    hideLoadingScreen();
    hideAuthScreen();
    initializeDataListeners();
  } else {
    currentUser = null;
    console.log('User not authenticated');
    cleanupDataListeners();
    hideLoadingScreen();
    showAuthScreen();
  }
});

// ══════════════════════════════════════════════
//  DATA LISTENERS (User-scoped)
// ══════════════════════════════════════════════

function cleanupDataListeners() {
  if (unsubscribers.tasks) unsubscribers.tasks();
  if (unsubscribers.reminders) unsubscribers.reminders();
  if (unsubscribers.countdowns) unsubscribers.countdowns();
  unsubscribers = { tasks: null, reminders: null, countdowns: null };
  tasks = [];
  reminders = [];
  countdowns = [];
  renderCalendar();
  renderDuelist();
  syncTodaysWorkDOM();
  renderHeroHabit();
  renderCountdowns();
}

function initializeDataListeners() {
  if (!currentUser) return;
  
  // Clean up existing listeners
  cleanupDataListeners();
  
  // Tasks listener
  const tasksQuery = query(
    collection(db, 'tasks'),
    where('userId', '==', currentUser.uid),
    orderBy('createdAt', 'desc')
  );
  unsubscribers.tasks = onSnapshot(tasksQuery, (snapshot) => {
    tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    renderCalendar();
    renderDuelist();
    syncTodaysWorkDOM();
    renderCalendarUpcoming();
  }, (error) => {
    console.error('Tasks listener error:', error);
    // Fallback if no index exists - use simple query
    const fallbackQuery = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    unsubscribers.tasks = onSnapshot(fallbackQuery, (snapshot) => {
      tasks = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(t => t.userId === currentUser.uid);
      renderCalendar();
      renderDuelist();
      syncTodaysWorkDOM();
      renderCalendarUpcoming();
    });
  });

  // Reminders listener
  const remindersQuery = query(
    collection(db, 'reminders'),
    where('userId', '==', currentUser.uid),
    orderBy('createdAt', 'asc')
  );
  unsubscribers.reminders = onSnapshot(remindersQuery, (snapshot) => {
    const newReminders = snapshot.docs.map(doc => {
      const newData = { id: doc.id, ...doc.data() };
      // Merge with existing local data to preserve any pending updates
      const existing = reminders.find(r => r.id === doc.id);
      if (existing) {
        // Merge completedDates - use the more recent array
        if (JSON.stringify(existing.completedDates) !== JSON.stringify(newData.completedDates)) {
          return newData;
        }
        // Also update if title or color changed
        if (existing.title !== newData.title || existing.color !== newData.color) {
          return newData;
        }
        return existing;
      }
      return newData;
    });
    reminders = newReminders;
    renderHeroHabit();
    renderHabitManager();
    renderHabitStats();
  }, (error) => {
    console.error('Reminders listener error:', error);
    const fallbackQuery = query(collection(db, 'reminders'), orderBy('createdAt', 'asc'));
    unsubscribers.reminders = onSnapshot(fallbackQuery, (snapshot) => {
      reminders = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(r => r.userId === currentUser.uid);
      renderHeroHabit();
      renderHabitManager();
      renderHabitStats();
    });
  });

  // Countdowns listener
  const countdownsQuery = query(
    collection(db, 'countdowns'),
    where('userId', '==', currentUser.uid),
    orderBy('targetDate', 'asc')
  );
  unsubscribers.countdowns = onSnapshot(countdownsQuery, (snapshot) => {
    countdowns = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    renderCountdowns();
  }, (error) => {
    console.error('Countdowns listener error:', error);
    const fallbackQuery = query(collection(db, 'countdowns'), orderBy('targetDate', 'asc'));
    unsubscribers.countdowns = onSnapshot(fallbackQuery, (snapshot) => {
      countdowns = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(c => c.userId === currentUser.uid);
      renderCountdowns();
    });
  });
}

// ══════════════════════════════════════════════
//  VIEW / TAB NAVIGATION + SWIPE GESTURES
// ══════════════════════════════════════════════

const views = ['tasks', 'calendar', 'countdown', 'zone'];
let activeViewIndex = 1;
const viewContainer = document.getElementById('view-container');
const tabBar = document.getElementById('tab-bar');
const tabItems = tabBar.querySelectorAll('.tab-item');

function switchView(viewName) {
  const idx = views.indexOf(viewName);
  if (idx === -1) return;
  activeViewIndex = idx;
  
  const percent = idx * (100 / views.length);
  viewContainer.style.transform = `translateX(-${percent}%)`;

  tabItems.forEach(t => {
    t.classList.toggle('active', t.dataset.view === viewName);
  });
  
  const fabTask = document.getElementById('add-task-btn');
  const fabCount = document.getElementById('add-countdown-btn');
  if (fabTask) fabTask.classList.toggle('hidden', viewName !== 'calendar');
  if (fabCount) fabCount.classList.toggle('hidden', viewName !== 'countdown');
}

tabItems.forEach(tab => {
  tab.addEventListener('click', () => switchView(tab.dataset.view));
});

let swipeStartX = 0;
let swipeStartY = 0;
let swipeDelta = 0;
let isSwiping = false;
let isVerticalScroll = false;
const SWIPE_THRESHOLD = 50;

viewContainer.addEventListener('touchstart', (e) => {
  swipeStartX = e.touches[0].clientX;
  swipeStartY = e.touches[0].clientY;
  swipeDelta = 0;
  isSwiping = false;
  isVerticalScroll = false;
}, { passive: true });

viewContainer.addEventListener('touchmove', (e) => {
  if (isVerticalScroll) return;

  const dx = e.touches[0].clientX - swipeStartX;
  const dy = e.touches[0].clientY - swipeStartY;

  if (!isSwiping) {
    if (Math.abs(dy) > 15 && Math.abs(dy) > Math.abs(dx)) {
      isVerticalScroll = true;
      return;
    }
    if (Math.abs(dx) > 15 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      isSwiping = true;
      viewContainer.classList.add('swiping');
    }
  }

  if (!isSwiping) return;

  swipeDelta = dx;
  const viewWidthPercent = 100 / views.length;
  const baseOffset = activeViewIndex * viewWidthPercent;
  const swipePercent = (dx / window.innerWidth) * viewWidthPercent;
  const offset = Math.max(0, Math.min((views.length - 1) * viewWidthPercent, baseOffset - swipePercent));
  viewContainer.style.transform = `translateX(-${offset}%)`;
}, { passive: true });

viewContainer.addEventListener('touchend', () => {
  viewContainer.classList.remove('swiping');
  if (!isSwiping) return;

  if (swipeDelta > SWIPE_THRESHOLD && activeViewIndex > 0) {
    switchView(views[activeViewIndex - 1]);
  } else if (swipeDelta < -SWIPE_THRESHOLD && activeViewIndex < views.length - 1) {
    switchView(views[activeViewIndex + 1]);
  } else {
    switchView(views[activeViewIndex]);
  }
  isSwiping = false;
}, { passive: true });

// ══════════════════════════════════════════════
//  CALENDAR + TASK ELEMENTS
// ══════════════════════════════════════════════

const taskModal = document.getElementById('task-modal');
const closeBtn = document.querySelector('.close-btn');
const addTaskBtn = document.getElementById('add-task-btn');
const taskForm = document.getElementById('task-form');
const deleteBtn = document.getElementById('delete-task-btn');

const monthEl = document.getElementById('current-month');
const prevBtn = document.getElementById('prev-month');
const nextBtn = document.getElementById('next-month');
const calendarGrid = document.getElementById('calendar-grid');
const duelistList = document.getElementById('duelist-list');

// ── Calendar Rendering Logic ──
function renderCalendar(animate = true) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  monthEl.textContent = `${monthNames[month]} ${year}`;

  const existingDays = calendarGrid.querySelectorAll('.calendar-day');
  existingDays.forEach(d => d.remove());

  if (animate) {
    calendarGrid.classList.add('transitioning');
    calendarGrid.addEventListener('animationend', () => {
      calendarGrid.classList.remove('transitioning');
    }, { once: true });
  }

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  for (let i = 0; i < firstDay; i++) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'calendar-day empty';
    calendarGrid.appendChild(emptyDiv);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const dayDiv = document.createElement('div');
    dayDiv.className = 'calendar-day';
    const dayOfWeek = new Date(year, month, i).getDay();

    if (animate) {
      dayDiv.style.animationDelay = `${(firstDay + i - 1) * 15}ms`;
    }

    if (year === today.getFullYear() && month === today.getMonth() && i === today.getDate()) {
      dayDiv.classList.add('today');
    }

    const numberSpan = document.createElement('div');
    numberSpan.className = 'day-number';
    numberSpan.textContent = i;
    dayDiv.appendChild(numberSpan);

    // Filter tasks for this day (including recurring instances)
    const dayTasks = tasks.map(t => {
      let isToday = false;
      const tStart = t.dueDate ? t.dueDate.slice(0, 10) : null;
      
      if (!tStart) return null;

      if (t.recurrence === 'daily') {
        isToday = dateStr >= tStart;
      } else if (t.recurrence === 'weekly') {
        const startDay = new Date(tStart).getDay();
        isToday = dateStr >= tStart && dayOfWeek === startDay;
      } else {
        isToday = tStart === dateStr;
      }
      
      if (!isToday) return null;

      const isFinished = t.completedDates && t.completedDates.includes(dateStr);
      return { ...t, isInstanceFinished: isFinished, instanceDate: dateStr };
    }).filter(t => t !== null);

    dayTasks.forEach(t => {
      const tag = document.createElement('div');
      tag.className = `event-tag type-${t.type}`;
      if (t.isInstanceFinished) tag.style.opacity = '0.4';
      tag.textContent = t.title;
      tag.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(t);
      });
      attachLongPress(tag, (e) => {
        e.stopPropagation();
        showContextMenu(e, t);
      });
      dayDiv.appendChild(tag);
    });

    dayDiv.addEventListener('click', () => {
      openAddModal(dateStr);
    });

    calendarGrid.appendChild(dayDiv);
  }
}

let seenTaskIds = new Set();

function renderDuelist() {
  duelistList.innerHTML = '';
  // Don't clear seenTaskIds - we only want to animate truly NEW cards
  const now = new Date();
  const dateStrToday = now.toISOString().slice(0, 10);
  // Clear the list first
  duelistList.innerHTML = '';
  
  // Get today's date string for comparison
  const today = new Date().toISOString().slice(0, 10);
  
  // Create instances for each task
  let instances = [];
  tasks.forEach(t => {
    const tStart = t.dueDate ? t.dueDate.slice(0, 10) : null;
    
    if (!tStart) {
      // Flexible task (no due date)
      const isFinished = t.completedDates?.includes('flexible');
      instances.push({ 
        ...t, 
        instanceDate: null, 
        isInstanceFinished: !!isFinished 
      });
      return;
    }

    if (t.recurrence === 'none') {
      // One-time task - show if today or in future, OR if completed
      const isCompleted = t.completedDates?.includes(tStart);
      if (new Date(tStart) >= now || isCompleted) {
        instances.push({ 
          ...t, 
          instanceDate: tStart, 
          isInstanceFinished: !!isCompleted 
        });
      }
    } else {
      // Recurring task - generate instances for next 14 days
      const taskStartDay = new Date(tStart);
      
      for (let i = 0; i < 14; i++) {
        let checkDate = new Date(now);
        checkDate.setDate(now.getDate() + i);
        let checkDateStr = checkDate.toISOString().slice(0, 10);
        
        if (checkDateStr < tStart) continue;

        let match = false;
        if (t.recurrence === 'daily') match = true;
        else if (t.recurrence === 'weekly') match = checkDate.getDay() === taskStartDay.getDay();

        if (match) {
          const isCompleted = t.completedDates?.includes(checkDateStr);
          instances.push({ 
            ...t, 
            instanceDate: checkDateStr, 
            isInstanceFinished: !!isCompleted 
          });
          break;
        }
      }
    }
  });

  // Sort: flexible first, then by date
  instances.sort((a, b) => {
    if (!a.instanceDate && !b.instanceDate) return 0;
    if (!a.instanceDate) return -1;
    if (!b.instanceDate) return 1;
    return new Date(a.instanceDate) - new Date(b.instanceDate);
  });

  if (instances.length === 0) {
    duelistList.innerHTML = `
      <div class="empty-state">
        <p>All clear!</p>
        <small>No upcoming deadlines right now.</small>
      </div>
    `;
    return;
  }

  // Render up to 15 instances
  instances.slice(0, 15).forEach((t, index) => {
    // Skip if this task is in Today's Work
    if (getTodaysWorkIds().includes(t.id)) {
      return;
    }
    
    const card = createTaskCard(t);
    if (!card) return;
    
    duelistList.appendChild(card);
  });
}

async function toggleComplete(id, dateStr) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  
  const key = dateStr || 'flexible';
  let currentCompleted = task.completedDates || [];
  if (currentCompleted.includes(key)) {
    currentCompleted = currentCompleted.filter(d => d !== key);
  } else {
    currentCompleted.push(key);
  }

  try {
    const taskRef = doc(db, 'tasks', id);
    await updateDoc(taskRef, {
      completedDates: currentCompleted
    });
  } catch (err) {
    console.error('Failed to toggle task', err);
  }
}

prevBtn.addEventListener('click', () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar();
});

nextBtn.addEventListener('click', () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar();
});

addTaskBtn.addEventListener('click', () => openAddModal());
closeBtn.addEventListener('click', closeModal);
taskModal.addEventListener('click', (e) => { if (e.target === taskModal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

function openAddModal(defaultDate = null) {
  document.getElementById('task-id').value = '';
  taskForm.reset();
  if (defaultDate) document.getElementById('task-date').value = `${defaultDate}T09:00`;
  document.getElementById('task-repeat').value = 'none';
  document.getElementById('modal-title').textContent = 'Add Task';
  deleteBtn.classList.add('hidden');
  taskModal.classList.remove('hidden');
  requestAnimationFrame(() => taskModal.classList.add('visible'));
}

function openEditModal(task) {
  document.getElementById('modal-title').textContent = 'Edit Task';
  document.getElementById('task-id').value = task.id;
  document.getElementById('task-title').value = task.title;
  document.getElementById('task-type').value = task.type;
  document.getElementById('task-date').value = task.dueDate || '';
  document.getElementById('task-desc').value = task.description || '';
  document.getElementById('task-repeat').value = task.recurrence || 'none';
  deleteBtn.classList.remove('hidden');
  taskModal.classList.remove('hidden');
  requestAnimationFrame(() => taskModal.classList.add('visible'));
}

function closeModal() {
  taskModal.classList.remove('visible');
  setTimeout(() => taskModal.classList.add('hidden'), 300);
}

taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUser) {
    alert('Please sign in to add tasks');
    return;
  }
  
  const id = document.getElementById('task-id').value;
  const payload = {
    title: document.getElementById('task-title').value,
    type: document.getElementById('task-type').value,
    dueDate: document.getElementById('task-date').value,
    description: document.getElementById('task-desc').value,
    recurrence: document.getElementById('task-repeat').value,
    userId: currentUser.uid
  };

  try {
    if (id) {
      // Preserve completedDates when editing existing task
      const existingTask = tasks.find(t => t.id === id);
      if (existingTask) {
        payload.completedDates = existingTask.completedDates || [];
      }
      const taskRef = doc(db, 'tasks', id);
      await updateDoc(taskRef, payload);
    } else {
      await addDoc(collection(db, 'tasks'), {
        ...payload,
        completedDates: [],
        createdAt: serverTimestamp()
      });
    }
    closeModal();
  } catch (err) {
    console.error('Error saving task', err);
  }
});

deleteBtn.addEventListener('click', async () => {
  const id = document.getElementById('task-id').value;
  if (!id) return;
  if (confirm('Delete this task?')) {
    try {
      await deleteDoc(doc(db, 'tasks', id));
      closeModal();
    } catch (err) {
      console.error('Failed to delete', err);
    }
  }
});

// ── ZONE TIMER Logic ──
const zoneSetup = document.getElementById('zone-setup');
const zoneActive = document.getElementById('zone-active');
const zoneDial = document.getElementById('zone-dial');
const zoneDialRotator = document.getElementById('zone-dial-rotator');
const zoneDialValue = document.getElementById('zone-dial-value');
const setupDialProgress = document.getElementById('setup-dial-progress');
const zoneStartBtn = document.getElementById('zone-start-btn');
const zoneTimeEl = document.getElementById('zone-time');
const zoneLabelEl = document.getElementById('zone-label');
const zoneRingProgress = document.getElementById('zone-ring-progress');
const zonePauseBtn = document.getElementById('zone-pause-btn');
const zoneStopBtn = document.getElementById('zone-stop-btn');
const zoneCompleteOverlay = document.getElementById('zone-complete-overlay');
const zoneCompleteDismiss = document.getElementById('zone-complete-dismiss');
const zoneCompleteMsg = document.getElementById('zone-complete-msg');

const SETUP_RING_CIRC = 2 * Math.PI * 130;
if (setupDialProgress) setupDialProgress.style.strokeDasharray = SETUP_RING_CIRC;

const RING_CIRCUMFERENCE = 2 * Math.PI * 90;
let zoneInterval = null;
let zoneTotalSeconds = 0;
let zoneRemainingSeconds = 0;
let zoneIsPaused = false;

function safeAnimateUpdate(el, newValue) {
  if (!el || el.textContent === newValue) return;
  
  el.dataset.targetValue = newValue;
  
  if (el.classList.contains('digit-out')) return;

  el.classList.remove('digit-in');
  el.classList.add('digit-out');
  
  setTimeout(() => {
    el.textContent = el.dataset.targetValue;
    el.classList.remove('digit-out');
    el.classList.add('digit-in');
  }, 250);
}

let setupMinutes = 45;
let isDraggingDial = false;

function setSetupDialValue(mins, forceDisplay = false) {
  setupMinutes = mins;
  
  if (forceDisplay || !isDraggingDial) {
    if(zoneDialValue) safeAnimateUpdate(zoneDialValue, mins.toString());
  }

  const deg = (mins / 120) * 360;
  if(zoneDialRotator) zoneDialRotator.style.transform = `rotate(${deg}deg)`;
  
  const setupConic = document.getElementById('setup-conic-ring');
  if (setupConic) {
    setupConic.style.setProperty('--p', `${(mins / 120) * 100}%`);
  }
}

function updateSetupDial(clientX, clientY) {
  if (!zoneDial) return;
  const rect = zoneDial.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let angle = Math.atan2(clientY - cy, clientX - cx);
  let deg = angle * (180 / Math.PI) + 90;
  if (deg < 0) deg += 360;
  let mins = Math.round(deg / 3);
  mins = Math.max(5, Math.round(mins / 5) * 5);
  if (mins > 120) mins = 120;
  if (mins !== setupMinutes) {
    setSetupDialValue(mins);
  }
}

if (zoneDial) {
  setSetupDialValue(45);
  zoneDial.addEventListener('pointerdown', (e) => { 
    isDraggingDial = true; 
    zoneDial.setPointerCapture(e.pointerId); 
    updateSetupDial(e.clientX, e.clientY); 
  });
  zoneDial.addEventListener('pointermove', (e) => { 
    if (!isDraggingDial) return; 
    updateSetupDial(e.clientX, e.clientY); 
  });
  zoneDial.addEventListener('pointerup', (e) => { 
    isDraggingDial = false; 
    zoneDial.releasePointerCapture(e.pointerId); 
    setSetupDialValue(setupMinutes, true);
    if (navigator.vibrate) navigator.vibrate(10); 
  });
  zoneDial.addEventListener('pointercancel', (e) => { 
    isDraggingDial = false; 
  });
}

if (zoneStartBtn) zoneStartBtn.addEventListener('click', () => startZone(setupMinutes * 60));
zonePauseBtn.addEventListener('click', () => { if (zoneIsPaused) resumeZone(); else pauseZone(); });
zoneStopBtn.addEventListener('click', () => stopZone());
zoneCompleteDismiss.addEventListener('click', () => zoneCompleteOverlay.classList.add('hidden'));

function startZone(totalSeconds) {
  zoneTotalSeconds = totalSeconds;
  zoneRemainingSeconds = totalSeconds;
  zoneIsPaused = false;
  const container = document.getElementById('zone-container');
  container.classList.remove('zone-mode-setup');
  container.classList.add('zone-mode-active');
  zoneRingProgress.style.strokeDasharray = RING_CIRCUMFERENCE;
  zoneRingProgress.style.strokeDashoffset = 0;
  updateZoneDisplay();
  updatePauseIcon();
  if (navigator.vibrate) navigator.vibrate(30);
  clearInterval(zoneInterval);
  zoneInterval = setInterval(() => {
    if (zoneIsPaused) return;
    zoneRemainingSeconds--;
    if (zoneRemainingSeconds <= 0) { 
      zoneRemainingSeconds = 0; 
      clearInterval(zoneInterval); 
      zoneInterval = null; 
      onZoneComplete(); 
    }
    updateZoneDisplay();
    updateRingProgress();
  }, 1000);
}

function pauseZone() { zoneIsPaused = true; zoneLabelEl.textContent = 'paused'; updatePauseIcon(); }
function resumeZone() { zoneIsPaused = false; zoneLabelEl.textContent = 'remaining'; updatePauseIcon(); }
function stopZone() { clearInterval(zoneInterval); zoneInterval = null; zoneIsPaused = false; const container = document.getElementById('zone-container'); container.classList.remove('zone-mode-active'); container.classList.add('zone-mode-setup'); if (navigator.vibrate) navigator.vibrate(20); }
function onZoneComplete() { const mins = Math.round(zoneTotalSeconds / 60); zoneCompleteMsg.textContent = `${mins} minute session completed.`; zoneCompleteOverlay.classList.remove('hidden'); if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]); stopZone(); }
function updateZoneDisplay() { 
  const h = Math.floor(zoneRemainingSeconds / 3600); 
  const m = Math.floor((zoneRemainingSeconds % 3600) / 60); 
  const s = zoneRemainingSeconds % 60; 
  let timeStr = "";
  if (h > 0) timeStr = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; 
  else timeStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; 
  
  if (zoneTimeEl) safeAnimateUpdate(zoneTimeEl, timeStr);
}
function updateRingProgress() { 
  const fraction = zoneRemainingSeconds / zoneTotalSeconds; 
  const activeConic = document.getElementById('active-conic-ring');
  if (activeConic) {
    activeConic.style.setProperty('--p', `${fraction * 100}%`);
  }
}
function updatePauseIcon() { const iconPause = zonePauseBtn.querySelector('.icon-pause'); const iconPlay = zonePauseBtn.querySelector('.icon-play'); if (zoneIsPaused) { iconPause.classList.add('hidden'); iconPlay.classList.remove('hidden'); } else { iconPause.classList.remove('hidden'); iconPlay.classList.add('hidden'); } }

// ── Touch Utilities ──
const LONG_PRESS_DURATION = 500;
function attachLongPress(element, callback) {
  let timer = null; let didLongPress = false; let willDrag = false;
  
  const start = (e) => { 
    didLongPress = false; 
    element.classList.add('long-pressing'); 
    timer = setTimeout(() => { 
      // Don't trigger long press if dragging or about to drag
      if (willDrag || element.classList.contains('dragging')) {
        element.classList.remove('long-pressing');
        return;
      }
      didLongPress = true; 
      element.classList.remove('long-pressing'); 
      if (navigator.vibrate) navigator.vibrate(30); 
      callback(e); 
    }, LONG_PRESS_DURATION); 
  };
  
  const cancel = () => { clearTimeout(timer); element.classList.remove('long-pressing'); };
  
  // Track if drag will happen
  element.addEventListener('dragstart', () => {
    willDrag = true;
    cancel();
    element.classList.add('dragging');
  });
  
  element.addEventListener('dragend', () => {
    willDrag = false;
  });
  
  element.addEventListener('click', (e) => { if (didLongPress) { e.stopPropagation(); e.preventDefault(); didLongPress = false; } }, true);
  element.addEventListener('touchstart', start, { passive: true });
  element.addEventListener('touchend', cancel); 
  element.addEventListener('touchmove', cancel); 
  element.addEventListener('touchcancel', cancel);
  element.addEventListener('mousedown', start); 
  element.addEventListener('mouseup', cancel); 
  element.addEventListener('mouseleave', cancel);
}

function showContextMenu(e, task) {
  dismissContextMenu();
  let x, y;
  if (e.touches && e.touches.length) { x = e.touches[0].clientX; y = e.touches[0].clientY; }
  else if (e.changedTouches && e.changedTouches.length) { x = e.changedTouches[0].clientX; y = e.changedTouches[0].clientY; }
  else { x = e.clientX || 100; y = e.clientY || 100; }
  const backdrop = document.createElement('div');
  backdrop.className = 'context-menu-backdrop';
  backdrop.addEventListener('click', dismissContextMenu); 
  backdrop.addEventListener('touchstart', dismissContextMenu, { passive: true });
  document.body.appendChild(backdrop);
  const menu = document.createElement('div');
  menu.className = 'context-menu'; menu.id = 'active-context-menu';
  const editItem = document.createElement('button'); 
  editItem.className = 'context-menu-item'; 
  editItem.textContent = 'Edit'; 
  editItem.addEventListener('click', () => { dismissContextMenu(); openEditModal(task); });
  const toggleItem = document.createElement('button'); 
  toggleItem.className = 'context-menu-item'; 
  toggleItem.textContent = task.completedDates && task.completedDates.includes(task.instanceDate) ? 'Mark Incomplete' : 'Mark Complete'; 
  toggleItem.addEventListener('click', () => { dismissContextMenu(); toggleComplete(task.id, task.instanceDate); });
  const deleteItem = document.createElement('button'); 
  deleteItem.className = 'context-menu-item danger'; 
  deleteItem.textContent = 'Delete'; 
  deleteItem.addEventListener('click', () => { dismissContextMenu(); deleteDoc(doc(db, 'tasks', task.id)); });
  menu.appendChild(editItem); 
  menu.appendChild(toggleItem); 
  menu.appendChild(deleteItem);
  document.body.appendChild(menu);
  const rect = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(12, Math.min(x, window.innerWidth - rect.width - 12))}px`;
  menu.style.top = `${Math.max(12, Math.min(y, window.innerHeight - rect.height - 12))}px`;
}

function dismissContextMenu() {
  const existing = document.getElementById('active-context-menu'); 
  if (existing) existing.remove();
  const backdrop = document.querySelector('.context-menu-backdrop'); 
  if (backdrop) backdrop.remove();
}

// ══════════════════════════════════════════════
//  CUSTOM UI COMPONENTS (SELECT & DATE PICKER)
// ══════════════════════════════════════════════

function initOptionGroups() {
  const groups = document.querySelectorAll('.option-group');
  
  groups.forEach(group => {
    const btns = group.querySelectorAll('.option-btn');
    const hiddenInput = group.querySelector('input[type="hidden"]');

    btns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const val = btn.dataset.value;
        
        hiddenInput.value = val;
        
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        if (navigator.vibrate) navigator.vibrate(5);
      });
    });
  });
}

function updateOptionGroupUI(inputId, value) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const group = input.closest('.option-group');
  if (!group) return;
  
  const btns = group.querySelectorAll('.option-btn');
  btns.forEach(btn => {
    if (btn.dataset.value === value) {
      btn.classList.add('active');
      input.value = value;
    } else {
      btn.classList.remove('active');
    }
  });
}

// ── Custom Date Picker Logic ──
const dpModal = document.getElementById('date-picker-modal');
let activeDPHiddenInput = null;
let activeDPDisplay = null;

const dpGrid = document.getElementById('dp-calendar-grid');
const dpMonthEl = document.getElementById('dp-current-month');
const dpPrevBtn = document.getElementById('dp-prev-month');
const dpNextBtn = document.getElementById('dp-next-month');

const dpTabs = document.querySelectorAll('.dp-tab');
const dpViews = document.querySelectorAll('.dp-view');

const dpDial = document.getElementById('dp-time-dial');
const dpDialHand = document.getElementById('dp-time-hand');
const dpDialValue = document.getElementById('dp-time-value');
const dpDialNumbers = document.getElementById('dp-dial-numbers');
const dpTimeModeBtns = document.querySelectorAll('.time-mode-btn');
const dpAMPMBtn = document.getElementById('time-ampm');

let dpSelectedDate = new Date();
let dpSelectedTime = { hrs: 9, mins: 0, ampm: 'AM' };
let dpViewingDate = new Date();
let dpTimeMode = 'hrs';
let isDraggingDPDial = false;
let dpCurrentRot = 0;

function initDatePicker() {
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.custom-date-trigger');
    if (!trigger) return;

    activeDPHiddenInput = trigger.parentElement.querySelector('input[type="hidden"]');
    activeDPDisplay = trigger.querySelector('span');

    if (activeDPHiddenInput && activeDPHiddenInput.value) {
      const d = new Date(activeDPHiddenInput.value);
      if (!isNaN(d)) {
        dpSelectedDate = new Date(d);
        dpViewingDate = new Date(d);
        let h = d.getHours();
        dpSelectedTime.ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        dpSelectedTime.hrs = h;
        dpSelectedTime.mins = d.getMinutes();
      }
    } else {
      dpSelectedDate = new Date();
      dpViewingDate = new Date();
      dpSelectedTime = { hrs: 9, mins: 0, ampm: 'AM' };
    }
    renderDPCalendar();
    updateDPTimeUI();
    openDPModal();
  });

  dpPrevBtn.addEventListener('click', () => { dpViewingDate.setMonth(dpViewingDate.getMonth() - 1); renderDPCalendar(); });
  dpNextBtn.addEventListener('click', () => { dpViewingDate.setMonth(dpViewingDate.getMonth() + 1); renderDPCalendar(); });

  dpTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      dpTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      dpViews.forEach(v => v.classList.add('hidden'));
      document.getElementById(`dp-${tab.dataset.tab}-view`).classList.remove('hidden');
    });
  });

  dpTimeModeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      dpTimeModeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      dpTimeMode = btn.dataset.mode;
      renderDPDialNumbers();
      updateDPTimeUI();
    });
  });

  dpAMPMBtn.addEventListener('click', () => {
    dpSelectedTime.ampm = dpSelectedTime.ampm === 'AM' ? 'PM' : 'AM';
    dpAMPMBtn.textContent = dpSelectedTime.ampm;
  });

  dpDial.addEventListener('pointerdown', (e) => { isDraggingDPDial = true; dpDial.setPointerCapture(e.pointerId); updateDPTimeFromCoords(e.clientX, e.clientY); });
  dpDial.addEventListener('pointermove', (e) => { if (isDraggingDPDial) updateDPTimeFromCoords(e.clientX, e.clientY); });
  dpDial.addEventListener('pointerup', (e) => { isDraggingDPDial = false; dpDial.releasePointerCapture(e.pointerId); if (navigator.vibrate) navigator.vibrate(5); });

  document.getElementById('dp-cancel').addEventListener('click', closeDPModal);
  document.getElementById('dp-confirm').addEventListener('click', confirmDPSelection);
}

function openDPModal() { dpModal.classList.remove('hidden'); requestAnimationFrame(() => dpModal.classList.add('visible')); }
function closeDPModal() { dpModal.classList.remove('visible'); setTimeout(() => dpModal.classList.add('hidden'), 300); }

function confirmDPSelection() {
  let h = dpSelectedTime.hrs;
  if (dpSelectedTime.ampm === 'PM' && h < 12) h += 12;
  if (dpSelectedTime.ampm === 'AM' && h === 12) h = 0;
  
  const finalDate = new Date(dpSelectedDate);
  finalDate.setHours(h, dpSelectedTime.mins, 0, 0);
  
  const y = finalDate.getFullYear();
  const m = String(finalDate.getMonth() + 1).padStart(2, '0');
  const d = String(finalDate.getDate()).padStart(2, '0');
  const hh = String(finalDate.getHours()).padStart(2, '0');
  const mm = String(finalDate.getMinutes()).padStart(2, '0');
  
  const dateStr = `${y}-${m}-${d}T${hh}:${mm}`;
  if (activeDPHiddenInput) activeDPHiddenInput.value = dateStr;
  
  const readable = finalDate.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  if (activeDPDisplay) activeDPDisplay.textContent = readable;
  
  closeDPModal();
}

function renderDPCalendar() {
  const year = dpViewingDate.getFullYear();
  const month = dpViewingDate.getMonth();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  dpMonthEl.textContent = `${monthNames[month]} ${year}`;

  dpGrid.innerHTML = '';
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    const d = document.createElement('div'); d.className = 'dp-day empty'; dpGrid.appendChild(d);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const d = document.createElement('div');
    d.className = 'dp-day';
    d.textContent = i;
    if (year === dpSelectedDate.getFullYear() && month === dpSelectedDate.getMonth() && i === dpSelectedDate.getDate()) d.classList.add('selected');
    const today = new Date();
    if (year === today.getFullYear() && month === today.getMonth() && i === today.getDate()) d.classList.add('today');

    d.addEventListener('click', () => {
      dpSelectedDate = new Date(year, month, i);
      dpGrid.querySelectorAll('.dp-day:not(.empty)').forEach(el => el.classList.remove('selected'));
      d.classList.add('selected');
    });
    dpGrid.appendChild(d);
  }

  const generatedCells = firstDay + daysInMonth;
  const paddingEnd = 42 - generatedCells;
  for (let i = 0; i < paddingEnd; i++) {
    const d = document.createElement('div'); d.className = 'dp-day empty'; dpGrid.appendChild(d);
  }
}

function renderDPDialNumbers() {
  dpDialNumbers.innerHTML = '';
  const radius = 85;
  for (let i = 1; i <= 12; i++) {
    const val = dpTimeMode === 'hrs' ? i : (i === 12 ? '00' : String(i * 5).padStart(2, '0'));
    const angle = (i * 30) - 90;
    const rad = angle * (Math.PI / 180);
    const x = Math.cos(rad) * radius;
    const y = Math.sin(rad) * radius;
    const num = document.createElement('div');
    num.className = 'dp-dial-num';
    num.textContent = val;
    num.style.transform = `translate(${x}px, ${y}px)`;
    dpDialNumbers.appendChild(num);
  }
}

function updateDPTimeUI() {
  const val = dpTimeMode === 'hrs' ? dpSelectedTime.hrs : dpSelectedTime.mins;
  dpDialValue.textContent = String(val).padStart(2, '0');
  
  let targetDeg = 0;
  if (dpTimeMode === 'hrs') {
    targetDeg = (dpSelectedTime.hrs % 12) * 30;
  } else {
    targetDeg = dpSelectedTime.mins * 6;
  }
  
  const currentMod = ((dpCurrentRot % 360) + 360) % 360;
  const diff = ((targetDeg - currentMod) + 540) % 360 - 180;
  dpCurrentRot += diff;
  
  dpDialHand.style.transform = `translateX(-50%) rotate(${dpCurrentRot}deg)`;
}

function updateDPTimeFromCoords(x, y) {
  const rect = dpDial.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let angle = Math.atan2(y - cy, x - cx) * (180 / Math.PI) + 90;
  if (angle < 0) angle += 360;

  if (dpTimeMode === 'hrs') {
    let h = Math.round(angle / 30) % 12;
    if (h === 0) h = 12;
    if (h !== dpSelectedTime.hrs) { dpSelectedTime.hrs = h; if (navigator.vibrate) navigator.vibrate(5); }
  } else {
    let m = Math.round(angle / 6) % 60;
    if (m !== dpSelectedTime.mins) { 
      dpSelectedTime.mins = m; 
      if (m % 5 === 0 && navigator.vibrate) navigator.vibrate(2);
    }
  }
  updateDPTimeUI();
}

// ── Integration with core Modals ──
const originalOpenAdd = openAddModal;
openAddModal = function(defaultDate) {
  originalOpenAdd(defaultDate);
  updateOptionGroupUI('task-type', '');
  updateOptionGroupUI('task-repeat', 'none');
  const hInput = document.getElementById('task-date');
  const dSpan = document.getElementById('date-display');
  if (defaultDate) {
    const d = new Date(defaultDate + 'T09:00');
    hInput.value = d.toISOString().slice(0, 16);
    dSpan.textContent = d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } else {
    hInput.value = '';
    dSpan.textContent = 'Select date & time';
  }
};

const originalOpenEdit = openEditModal;
openEditModal = function(task) {
  originalOpenEdit(task);
  updateOptionGroupUI('task-type', task.type);
  updateOptionGroupUI('task-repeat', task.recurrence || 'none');
  const hInput = document.getElementById('task-date');
  const dSpan = document.getElementById('date-display');
  if (task.dueDate) {
    const d = new Date(task.dueDate);
    hInput.value = task.dueDate;
    dSpan.textContent = d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } else {
    hInput.value = '';
    dSpan.textContent = 'Select date & time';
  }
};

// ══════════════════════════════════════════════
//  TASKS PAGE & DAILY REMINDERS
// ══════════════════════════════════════════════

function initQuickAdd() {
  const input = document.getElementById('quick-add-input');
  const submit = document.getElementById('quick-add-submit');

  const add = async () => {
    if (!currentUser) {
      alert('Please sign in to add tasks');
      return;
    }
    
    const title = input.value.trim();
    if (!title) return;
    
    try {
      await addDoc(collection(db, 'tasks'), {
        title,
        type: 'Homework',
        dueDate: null,
        recurrence: 'none',
        completedDates: [],
        userId: currentUser.uid,
        createdAt: serverTimestamp()
      });
      input.value = '';
      if (navigator.vibrate) navigator.vibrate(10);
    } catch (e) {
      console.error("Error quick adding:", e);
    }
  };

  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  submit.addEventListener('click', add);
}

let currentHabitIndex = 0;
let habitResetInterval = null;
let statsViewingDate = new Date();

function initReminders() {
  const settingsBtn = document.getElementById('habit-settings-btn');
  const manageModal = document.getElementById('habit-manage-modal');
  const closeManageBtn = document.getElementById('close-manage-btn');

  const openManage = () => {
    manageModal.classList.remove('hidden');
    requestAnimationFrame(() => manageModal.classList.add('visible'));
    document.getElementById('habit-edit-panel').classList.add('hidden');
    document.getElementById('habit-manage-list').classList.remove('hidden');
    document.querySelector('.habit-add-bar').classList.remove('hidden');
  };

  const closeManage = () => {
    manageModal.classList.remove('visible');
    setTimeout(() => manageModal.classList.add('hidden'), 300);
  };

  if(settingsBtn) settingsBtn.addEventListener('click', openManage);
  if(closeManageBtn) closeManageBtn.addEventListener('click', closeManage);
  if(manageModal) manageModal.addEventListener('click', (e) => { if(e.target === manageModal) closeManage(); });

  const input = document.getElementById('add-reminder-input');
  const submit = document.getElementById('add-reminder-submit');
  const add = async () => {
    if (!currentUser) {
      alert('Please sign in to add habits');
      return;
    }
    const title = input.value.trim();
    if (!title) return;
    try {
      await addDoc(collection(db, 'reminders'), {
        title, 
        completedDates: [], 
        userId: currentUser.uid,
        color: '#FFFFFF',
        createdAt: serverTimestamp()
      });
      input.value = '';
      if (navigator.vibrate) navigator.vibrate(10);
    } catch (e) {
      console.error("Error adding habit:", e);
    }
  };
  if(input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  if(submit) submit.addEventListener('click', add);

  document.getElementById('habit-prev').addEventListener('click', () => {
    if(reminders.length < 2) return;
    const display = document.getElementById('hero-habit-display');
    display.classList.add('fade-switch');
    setTimeout(() => {
      currentHabitIndex = (currentHabitIndex - 1 + reminders.length) % reminders.length;
      renderHeroHabit();
    }, 150);
    setTimeout(() => display.classList.remove('fade-switch'), 300);
  });
  document.getElementById('habit-next').addEventListener('click', () => {
    if(reminders.length < 2) return;
    const display = document.getElementById('hero-habit-display');
    display.classList.add('fade-switch');
    setTimeout(() => {
      currentHabitIndex = (currentHabitIndex + 1) % reminders.length;
      renderHeroHabit();
    }, 150);
    setTimeout(() => display.classList.remove('fade-switch'), 300);
  });
  
  document.querySelectorAll('.color-swatch').forEach(sw => {
    sw.addEventListener('click', (e) => {
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      e.target.classList.add('selected');
      document.getElementById('custom-color-picker').value = e.target.dataset.color;
    });
  });

  document.getElementById('custom-color-picker').addEventListener('input', (e) => {
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
  });

  document.getElementById('edit-habit-save').addEventListener('click', async () => {
    const id = document.getElementById('edit-habit-id').value;
    const title = document.getElementById('edit-habit-input').value.trim();
    const selectedSwatch = document.querySelector('.color-swatch.selected');
    const customColor = document.getElementById('custom-color-picker').value;
    const color = selectedSwatch ? selectedSwatch.dataset.color : customColor;
    
    if(!id || !title) return;
    try {
      await updateDoc(doc(db, 'reminders', id), { title, color });
      // Refresh local data
      reminders = reminders.map(r => r.id === id ? { ...r, title, color } : r);
      renderHabitManager();
      renderHeroHabit();
      const editPanel = document.getElementById('habit-edit-panel');
      editPanel.classList.remove('visible');
      setTimeout(() => {
        editPanel.classList.add('hidden');
        document.getElementById('habit-manage-list').classList.remove('hidden');
        document.querySelector('.habit-add-bar').classList.remove('hidden');
      }, 300);
    } catch(e) { console.error("Error updating habit:", e); }
  });

  document.getElementById('edit-habit-delete').addEventListener('click', async () => {
    const id = document.getElementById('edit-habit-id').value;
    if(!id) return;
    if(confirm('Delete this habit?')) {
      await deleteDoc(doc(db, 'reminders', id));
      const editPanel = document.getElementById('habit-edit-panel');
      editPanel.classList.remove('visible');
      setTimeout(() => {
        editPanel.classList.add('hidden');
        document.getElementById('habit-manage-list').classList.remove('hidden');
        document.querySelector('.habit-add-bar').classList.remove('hidden');
      }, 300);
    }
  });

  document.getElementById('hero-check-btn').addEventListener('click', () => {
    const rem = reminders[currentHabitIndex];
    if(!rem) return;
    const today = new Date().toISOString().split('T')[0];
    toggleReminderCustom(rem, today);
  });

  if(habitResetInterval) clearInterval(habitResetInterval);
  habitResetInterval = setInterval(updateHeroCountdown, 1000);
  updateHeroCountdown();

  const statsBtn = document.getElementById('habit-stats-btn');
  const statsModal = document.getElementById('habit-stats-modal');
  const closeStatsBtn = document.getElementById('close-stats-btn');
  
  if(statsBtn) {
    statsBtn.addEventListener('click', () => {
      if(reminders.length === 0) return;
      statsViewingDate = new Date();
      renderHabitStats();
      statsModal.classList.remove('hidden');
      requestAnimationFrame(() => statsModal.classList.add('visible'));
    });
  }
  
  const closeStats = () => {
    statsModal.classList.remove('visible');
    setTimeout(() => statsModal.classList.add('hidden'), 300);
  };
  if(closeStatsBtn) closeStatsBtn.addEventListener('click', closeStats);
  if(statsModal) statsModal.addEventListener('click', (e) => { if(e.target === statsModal) closeStats(); });

  document.getElementById('hc-prev-month').addEventListener('click', () => {
    statsViewingDate.setMonth(statsViewingDate.getMonth() - 1);
    renderHabitStats();
  });
  document.getElementById('hc-next-month').addEventListener('click', () => {
    statsViewingDate.setMonth(statsViewingDate.getMonth() + 1);
    renderHabitStats();
  });
}

function renderHeroHabit() {
  const display = document.getElementById('hero-habit-display');
  const empty = document.getElementById('hero-habit-empty');
  
  if (reminders.length === 0) {
    if(display) display.classList.add('hidden');
    if(empty) empty.classList.remove('hidden');
    return;
  }
  
  if(display) display.classList.remove('hidden');
  if(empty) empty.classList.add('hidden');

  const rem = reminders[currentHabitIndex];
  if (!rem) return;
  
  const today = new Date().toISOString().split('T')[0];
  const isDoneToday = rem.completedDates && rem.completedDates.includes(today);
  const color = rem.color || '#FFFFFF';

  const titleEl = document.getElementById('hero-habit-title');
  titleEl.textContent = rem.title;
  titleEl.style.background = `linear-gradient(to right, ${color}, rgba(255,255,255,0.8))`;
  titleEl.style.webkitBackgroundClip = 'text';
  titleEl.style.backgroundClip = 'text';
  titleEl.style.filter = `drop-shadow(0 0 20px ${color}80)`;
  
  const aura = document.getElementById('hero-aura');
  if (aura) {
    aura.style.background = `radial-gradient(circle, ${color} 0%, transparent 70%)`;
  }
  
  const checkBtn = document.getElementById('hero-check-btn');
  checkBtn.style.filter = `drop-shadow(0 0 25px ${color}33)`;
  
  const ringProgress = document.getElementById('hero-ring-progress');
  const ringBg = document.querySelector('.hero-ring-bg');
  
  if (ringProgress) {
    ringProgress.style.stroke = color;
    ringBg.style.stroke = `${color}33`;
  }
  
  const checkIcon = document.querySelector('.hero-check-icon');
  if (checkIcon) checkIcon.style.color = color;

  if (isDoneToday) {
    checkBtn.classList.add('completed');
    if(ringProgress) ringProgress.style.fill = `${color}1A`;
  } else {
    checkBtn.classList.remove('completed');
    if(ringProgress) ringProgress.style.fill = 'transparent';
  }
  
  document.getElementById('habit-prev').style.opacity = reminders.length > 1 ? '1' : '0';
  document.getElementById('habit-next').style.opacity = reminders.length > 1 ? '1' : '0';
  document.getElementById('habit-prev').style.pointerEvents = reminders.length > 1 ? 'auto' : 'none';
  document.getElementById('habit-next').style.pointerEvents = reminders.length > 1 ? 'auto' : 'none';
}

function renderHabitManager() {
  const list = document.getElementById('habit-manage-list');
  if(!list) return;
  list.innerHTML = '';
  reminders.forEach(rem => {
    const item = document.createElement('div');
    item.className = 'habit-manage-item';
    item.style.cursor = 'pointer';
    
    const dotColor = rem.color || '#FFFFFF';
    item.innerHTML = `<div style="display:flex; align-items:center; gap:8px;"><div style="width:12px; height:12px; border-radius:50%; background:${dotColor};"></div><span>${rem.title}</span></div> <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.5;"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
    
    item.addEventListener('click', () => {
      openHabitEdit(rem);
    });
    
    list.appendChild(item);
  });
}

function openHabitEdit(rem) {
  const editPanel = document.getElementById('habit-edit-panel');
  document.getElementById('habit-manage-list').classList.add('hidden');
  document.querySelector('.habit-add-bar').classList.add('hidden');
  
  editPanel.classList.remove('hidden');
  requestAnimationFrame(() => editPanel.classList.add('visible'));
  
  document.getElementById('edit-habit-id').value = rem.id;
  document.getElementById('edit-habit-input').value = rem.title;
  
  const color = rem.color || '#FFFFFF';
  document.getElementById('custom-color-picker').value = color;
  document.querySelectorAll('.color-swatch').forEach(sw => {
    sw.classList.toggle('selected', sw.dataset.color.toUpperCase() === color.toUpperCase());
  });
}

function updateHeroCountdown() {
  const now = new Date();
  const reset = new Date();
  reset.setHours(24, 0, 0, 0);
  const diff = reset - now;
  
  const h = Math.floor(diff / (1000 * 60 * 60));
  const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const s = Math.floor((diff % (1000 * 60)) / 1000);
  
  const el = document.getElementById('hero-reset-time');
  if(el) el.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

async function toggleReminderCustom(rem, dateStr) {
  const ref = doc(db, 'reminders', rem.id);
  let newDates = [...(rem.completedDates || [])];
  
  if (newDates.includes(dateStr)) {
    newDates = newDates.filter(d => d !== dateStr);
  } else {
    newDates.push(dateStr);
    if (navigator.vibrate) navigator.vibrate([10, 30]);
  }
  
  // Update local array immediately for instant UI feedback
  rem.completedDates = newDates;
  
  await updateDoc(ref, { completedDates: newDates });
  
  // Re-render habit stats to reflect the change
  renderHabitStats();
  // Also update hero habit display if this is the current habit
  if (reminders[currentHabitIndex]?.id === rem.id) {
    renderHeroHabit();
  }
}

function renderHabitStats() {
  if(reminders.length === 0) return;
  const rem = reminders[currentHabitIndex];
  const color = rem.color || '#FFFFFF';
  
  const statValEl = document.getElementById('stat-total-checks');
  statValEl.textContent = rem.completedDates ? rem.completedDates.length : 0;
  statValEl.style.color = color;
  statValEl.style.textShadow = `0 0 20px ${color}80`;
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const y = statsViewingDate.getFullYear();
  const m = statsViewingDate.getMonth();
  document.getElementById('hc-current-month').textContent = `${monthNames[m]} ${y}`;
  
  const grid = document.getElementById('hc-grid');
  grid.innerHTML = '';
  
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  
  for (let i = 0; i < firstDay; i++) {
    const d = document.createElement('div'); d.className = 'dp-day empty'; grid.appendChild(d);
  }
  
  for (let i = 1; i <= daysInMonth; i++) {
    const d = document.createElement('div');
    d.className = 'dp-day';
    d.textContent = i;
    
    const loopDate = new Date(y, m, i);
    const yy = loopDate.getFullYear();
    const mm = String(loopDate.getMonth()+1).padStart(2,'0');
    const dd = String(loopDate.getDate()).padStart(2,'0');
    const dateStr = `${yy}-${mm}-${dd}`;
    
    if (rem.completedDates && rem.completedDates.includes(dateStr)) {
      d.style.background = `${color}33`;
      d.style.borderColor = color;
      d.style.color = '#fff';
      d.style.boxShadow = `0 0 10px ${color}4d`;
    }
    
    d.addEventListener('click', () => {
      toggleReminderCustom(rem, dateStr);
    });
    
    grid.appendChild(d);
  }
}

function renderCalendarUpcoming() {
  const list = document.getElementById('calendar-upcoming-list');
  if (!list) return;
  list.innerHTML = '';
  
  const now = new Date();
  now.setHours(0,0,0,0);
  const nextWeek = new Date(now);
  nextWeek.setDate(now.getDate() + 7);

  const upcoming = tasks.filter(t => {
    if (!t.dueDate) return false;
    if (t.type !== 'Homework' && t.type !== 'Event' && t.type !== 'Project') return false;
    
    const d = new Date(t.dueDate);
    return d >= now && d <= nextWeek;
  }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  if (upcoming.length === 0) {
    list.innerHTML = `<div class="empty-state"><p>Nothing due this week.</p></div>`;
    return;
  }

  upcoming.slice(0, 8).forEach(t => {
    const card = document.createElement('div');
    card.className = 'upcoming-mini-card';
    
    const due = new Date(t.dueDate);
    const today = new Date();
    today.setHours(0,0,0,0);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    let dueStr = "";
    if (diffDays === 0) dueStr = "Today";
    else if (diffDays === 1) dueStr = "Tomorrow";
    else dueStr = `${diffDays}d`;

    card.innerHTML = `
      <div class="mini-card-header">
        <span class="mini-card-title">${t.title}</span>
        <span class="mini-card-due">${dueStr}</span>
      </div>
      <div class="mini-card-meta">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        ${due.toLocaleDateString([], { month: 'short', day: 'numeric' })} • ${due.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    `;
    card.addEventListener('click', () => openEditModal(t));
    list.appendChild(card);
  });
}

// ══════════════════════════════════════════════
//  COUNTDOWN LOGIC
// ══════════════════════════════════════════════
let activeCdInterval = null;

function initCountdowns() {
  const btnAdd = document.getElementById('add-countdown-btn');
  const modal = document.getElementById('countdown-modal');
  const closeBtn = document.querySelector('.close-cd-btn');
  const form = document.getElementById('countdown-form');
  const backBtn = document.getElementById('cd-back-btn');
  const deleteBtn = document.getElementById('delete-cd-btn');
  
  btnAdd.addEventListener('click', () => {
    if (!currentUser) {
      alert('Please sign in to add countdowns');
      return;
    }
    document.getElementById('cd-id').value = '';
    form.reset();
    document.getElementById('cd-date').value = '';
    document.getElementById('cd-date-display').textContent = 'Select date & time';
    document.getElementById('cd-modal-title').textContent = 'Add Countdown';
    document.getElementById('cd-priority').value = 'normal';
    updateOptionGroupUI('cd-priority', 'normal');
    modal.classList.remove('hidden');
    requestAnimationFrame(() => modal.classList.add('visible'));
  });

  const closeCD = () => {
    modal.classList.remove('visible');
    setTimeout(() => modal.classList.add('hidden'), 300);
  };

  closeBtn.addEventListener('click', closeCD);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeCD(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) {
      alert('Please sign in to add countdowns');
      return;
    }
    const id = document.getElementById('cd-id').value;
    const title = document.getElementById('cd-title').value;
    const targetDate = document.getElementById('cd-date').value;
    
    const priority = document.getElementById('cd-priority').value;
    
    if (id) {
      await updateDoc(doc(db, 'countdowns', id), { title, targetDate, priority });
    } else {
      await addDoc(collection(db, 'countdowns'), { 
        title, 
        targetDate, 
        priority, 
        userId: currentUser.uid,
        createdAt: serverTimestamp() 
      });
    }
    closeCD();
  });

  deleteBtn.addEventListener('click', async () => {
    const id = document.getElementById('cd-id').value;
    if (!id) return;
    if (confirm('Delete this countdown?')) {
      await deleteDoc(doc(db, 'countdowns', id));
      closeCD();
      backToGallery();
    }
  });

  if (backBtn) backBtn.addEventListener('click', backToGallery);
}

function renderCountdowns() {
  const list = document.getElementById('countdown-list');
  if (!list) return;
  list.innerHTML = '';
  const now = new Date().getTime();

  if (countdowns.length === 0) {
    list.classList.remove('compact-layout');
    list.innerHTML = `<div class="empty-state"><p>No target events yet.</p><small>Add a date to look forward to!</small></div>`;
    return;
  }

  const count = countdowns.length;
  let tier = 'hero';
  if (count > 20) tier = 'mini';
  else if (count > 10) tier = 'compact';
  else if (count > 4) tier = 'standard';
  
  list.className = `countdown-grid tier-${tier}`;

  countdowns.forEach(cd => {
    const targetDateObj = new Date(cd.targetDate);
    const target = targetDateObj.getTime();
    
    let daysLeft = 0;
    if (!isNaN(target)) {
      let diff = target - now;
      if (diff < 0) diff = 0;
      daysLeft = Math.floor(diff / (1000 * 60 * 60 * 24));
    }

    const card = document.createElement('div');
    card.className = `countdown-card${cd.priority === 'major' ? ' major' : ''}`;
    card.innerHTML = `
      <div class="cd-title">${cd.title}</div>
      <div class="cd-stats">
        <span class="cd-days-val">${daysLeft}</span>
        <span class="cd-days-lbl">Days</span>
      </div>
    `;
    card.addEventListener('click', () => openCountdownDetail(cd));
    
    attachLongPress(card, (e) => {
      e.stopPropagation();
      document.getElementById('cd-id').value = cd.id;
      document.getElementById('cd-title').value = cd.title;
      document.getElementById('cd-date').value = cd.targetDate;
      if (cd.targetDate) {
        const d = new Date(cd.targetDate);
        document.getElementById('cd-date-display').textContent = d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      } else {
        document.getElementById('cd-date-display').textContent = 'Select date & time';
      }
      document.getElementById('cd-modal-title').textContent = 'Edit Countdown';
      document.getElementById('cd-priority').value = cd.priority || 'normal';
      updateOptionGroupUI('cd-priority', cd.priority || 'normal');
      document.getElementById('delete-cd-btn').classList.remove('hidden');
      const modal = document.getElementById('countdown-modal');
      modal.classList.remove('hidden');
      requestAnimationFrame(() => modal.classList.add('visible'));
    });

    list.appendChild(card);
  });
}

function openCountdownDetail(cd) {
  document.getElementById('cd-gallery-view').classList.add('hidden');
  document.getElementById('cd-detail-view').classList.remove('hidden');
  
  document.getElementById('cd-detail-title').textContent = cd.title;
  const tDate = new Date(cd.targetDate);
  document.getElementById('cd-detail-target').textContent = tDate.toLocaleString([], {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute:'2-digit'
  });

  if (activeCdInterval) clearInterval(activeCdInterval);

  const update = () => {
    const now = new Date().getTime();
    let diff = tDate.getTime() - now;
    if (diff < 0) diff = 0;

    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);

    document.getElementById('cd-days').textContent = String(d).padStart(2, '0');
    document.getElementById('cd-hours').textContent = String(h).padStart(2, '0');
    document.getElementById('cd-mins').textContent = String(m).padStart(2, '0');
    document.getElementById('cd-secs').textContent = String(s).padStart(2, '0');
  };
  
  update();
  activeCdInterval = setInterval(update, 1000);
}

function backToGallery() {
  if (activeCdInterval) clearInterval(activeCdInterval);
  document.getElementById('cd-detail-view').classList.add('hidden');
  document.getElementById('cd-gallery-view').classList.remove('hidden');
}

// ══════════════════════════════════════════════
//  TODAY'S WORK - SIMPLE & ROBUST
// ══════════════════════════════════════════════
const TODAYS_WORK_KEY = 'todaysWork'; // Using original key for compatibility

function getTodaysWorkIds() {
  try {
    const saved = localStorage.getItem(TODAYS_WORK_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

function setTodaysWorkIds(ids) {
  localStorage.setItem(TODAYS_WORK_KEY, JSON.stringify(ids));
}

function addToTodaysWork(taskId) {
  const ids = getTodaysWorkIds();
  if (!ids.includes(taskId)) {
    ids.push(taskId);
    setTodaysWorkIds(ids);
  }
}

function removeFromTodaysWork(taskId) {
  const ids = getTodaysWorkIds().filter(id => id !== taskId);
  setTodaysWorkIds(ids);
}

function syncTodaysWorkDOM() {
  const todaysWorkList = document.getElementById('todays-work-list');
  if (!todaysWorkList) return;
  
  const savedIds = getTodaysWorkIds();
  if (savedIds.length === 0) return;
  
  const now = new Date();
  const dateStrToday = now.toISOString().slice(0, 10);
  
  // Check each saved ID - if task still exists, ensure it's in Today's Work
  savedIds.forEach(id => {
    const existsInTW = todaysWorkList.querySelector(`.task-card[data-id="${id}"]`);
    const taskExists = tasks.some(t => t.id === id);
    
    // If not in TW but task exists, create a new card
    if (!existsInTW && taskExists) {
      const rawTask = tasks.find(t => t.id === id);
      
      // Calculate isInstanceFinished for Today's Work (check today's date or 'flexible')
      const isFinished = rawTask.completedDates?.includes(dateStrToday) || 
                         rawTask.completedDates?.includes('flexible');
      
      const taskForCard = { ...rawTask, isInstanceFinished: isFinished };
      const card = createTaskCard(taskForCard);
      if (card) {
        todaysWorkList.appendChild(card);
      }
    }
  });
  
  // Only clean up localStorage if tasks actually loaded successfully
  if (tasks.length > 0) {
    const validIds = savedIds.filter(id => tasks.some(t => t.id === id));
    if (validIds.length !== savedIds.length) {
      setTodaysWorkIds(validIds);
    }
  }
  
  // Update empty state
  const emptyState = todaysWorkList.querySelector('.empty-state-mini');
  if (emptyState) {
    const hasTasks = todaysWorkList.querySelectorAll('.task-card').length > 0;
    emptyState.style.display = hasTasks ? 'none' : 'block';
  }
}

// Helper to create a task card element
function createTaskCard(task) {
  if (!task) return null;
  
  const card = document.createElement('div');
  const completedClass = task.isInstanceFinished ? ' completed' : '';
  card.className = `task-card type-${task.type || 'default'}${completedClass}`;
  card.draggable = true;
  card.dataset.id = task.id;
  
  const instanceKey = task.id;
  seenTaskIds.add(instanceKey);
  
  const checkbox = document.createElement('div');
  checkbox.className = `task-checkbox${task.isInstanceFinished ? ' checked' : ''}`;
  checkbox.addEventListener('click', async (e) => {
    e.stopPropagation();
    checkbox.classList.toggle('checked');
    card.classList.toggle('completed');
    if (navigator.vibrate) navigator.vibrate(5);
    await toggleComplete(task.id, task.instanceDate);
  });
  
  const title = document.createElement('h3');
  title.textContent = task.title || 'Untitled Task';
  
  const header = document.createElement('div');
  header.className = 'task-card-header';
  header.appendChild(checkbox);
  header.appendChild(title);
  
  if (task.type) {
    const badge = document.createElement('span');
    badge.className = `task-type-badge type-${task.type}`;
    badge.textContent = task.type;
    header.appendChild(badge);
  }
  
  card.appendChild(header);
  
  if (task.instanceDate) {
    const formatted = new Date(task.instanceDate).toLocaleString([], {
      weekday: 'short', month: 'short', day: 'numeric'
    });
    const dateSpan = document.createElement('span');
    dateSpan.className = 'task-date';
    dateSpan.textContent = formatted;
    card.appendChild(dateSpan);
  }
  
  if (task.description) {
    const desc = document.createElement('p');
    desc.className = 'task-desc';
    desc.textContent = task.description;
    card.appendChild(desc);
  }
  
  card.addEventListener('click', () => openEditModal(task));
  attachLongPress(card, (e) => showContextMenu(e, task));
  
  return card;
}

function initDragAndDrop() {
  const todaysWorkCard = document.getElementById('todays-work-card');
  const todaysWorkList = document.getElementById('todays-work-list');
  const fullTasksList = document.getElementById('duelist-list');
  const clearBtn = document.getElementById('clear-todays-work');
  let draggedItem = null;

  document.addEventListener('dragstart', (e) => {
    if (e.target.classList.contains('task-card')) {
      draggedItem = e.target;
      e.target.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', '');
    }
  });

  document.addEventListener('dragend', (e) => {
    if (e.target.classList.contains('task-card')) {
      e.target.classList.remove('dragging');
      document.querySelectorAll('.drop-zone').forEach(zone => zone.classList.remove('drag-over'));
      draggedItem = null;
    }
  });

  [todaysWorkCard, fullTasksList].forEach(zone => {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', (e) => {
      if (!zone.contains(e.relatedTarget)) {
        zone.classList.remove('drag-over');
      }
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');

      if (draggedItem) {
        const taskId = draggedItem.dataset.id;
        const isMovingToTW = zone.id === 'todays-work-card';
        const isMovingFromTW = zone.id === 'duelist-list' && draggedItem.parentElement === todaysWorkList;

        if (isMovingToTW) addToTodaysWork(taskId);
        else if (isMovingFromTW) removeFromTodaysWork(taskId);

        draggedItem.classList.add('animate-move');
        const targetList = isMovingToTW ? todaysWorkList : fullTasksList;
        targetList.appendChild(draggedItem);
        syncTodaysWorkDOM();
      }
    });
  });

  clearBtn.addEventListener('click', () => {
    setTodaysWorkIds([]);
    todaysWorkList.querySelectorAll('.task-card').forEach(task => {
      task.classList.remove('animate-move');
      fullTasksList.appendChild(task);
    });
    syncTodaysWorkDOM();
  });
}

// ══════════════════════════════════════════════
//  INITIALIZATION
// ══════════════════════════════════════════════

// Initialize components
initOptionGroups();
initDatePicker();
renderDPDialNumbers();
initQuickAdd();
initReminders();
initCountdowns();
initDragAndDrop();

// Create loading screen immediately while waiting for auth
createLoadingScreen();

// Render initial empty states
renderCalendar();
renderHeroHabit();
renderCountdowns();

// Render tasks after all components are initialized
renderDuelist();
// Today's work is synced after first Firebase data arrives (see auth state listener)

// Add sign out button listener
const signoutBtn = document.getElementById('signout-btn');
signoutBtn.style.display = 'none';

signoutBtn.addEventListener('click', async () => {
  if (confirm('Are you sure you want to sign out?')) {
    await signOutUser();
  }
});

// Update sign out button visibility based on auth state
onAuthStateChanged(auth, (user) => {
  signoutBtn.style.display = user ? 'block' : 'none';
});

console.log('Tenor app initialized. Waiting for authentication...');
