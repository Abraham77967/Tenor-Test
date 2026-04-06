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
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

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
const tasksCol = collection(db, 'tasks');

let tasks = [];
let currentDate = new Date();

// ══════════════════════════════════════════════
//  VIEW / TAB NAVIGATION + SWIPE GESTURES
// ══════════════════════════════════════════════

const views = ['calendar', 'zone'];
let activeViewIndex = 0;
const viewContainer = document.getElementById('view-container');
const tabBar = document.getElementById('tab-bar');
const tabItems = tabBar.querySelectorAll('.tab-item');

function switchView(viewName) {
  const idx = views.indexOf(viewName);
  if (idx === -1) return;
  activeViewIndex = idx;
  viewContainer.style.transform = `translateX(-${idx * 50}%)`;

  tabItems.forEach(t => {
    t.classList.toggle('active', t.dataset.view === viewName);
  });
}

tabItems.forEach(tab => {
  tab.addEventListener('click', () => switchView(tab.dataset.view));
});

let swipeStartX = 0;
let swipeStartY = 0;
let swipeDelta = 0;
let isSwiping = false;
const SWIPE_THRESHOLD = 50;

viewContainer.addEventListener('touchstart', (e) => {
  swipeStartX = e.touches[0].clientX;
  swipeStartY = e.touches[0].clientY;
  swipeDelta = 0;
  isSwiping = false;
}, { passive: true });

viewContainer.addEventListener('touchmove', (e) => {
  const dx = e.touches[0].clientX - swipeStartX;
  const dy = e.touches[0].clientY - swipeStartY;

  if (!isSwiping && Math.abs(dx) > 10) {
    if (Math.abs(dx) > Math.abs(dy) * 1.2) {
      isSwiping = true;
      viewContainer.classList.add('swiping');
    }
  }

  if (!isSwiping) return;

  swipeDelta = dx;
  const baseOffset = activeViewIndex * 50;
  const swipePercent = (dx / window.innerWidth) * 50;
  const offset = Math.max(0, Math.min((views.length - 1) * 50, baseOffset - swipePercent));
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

// ── Init ──
function init() {
  const q = query(tasksCol, orderBy('createdAt', 'desc'));
  onSnapshot(q, (snapshot) => {
    tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    renderCalendar();
    renderDuelist();
  });
}

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

    const dayTasks = tasks.filter(t => t.dueDate && t.dueDate.startsWith(dateStr));
    dayTasks.forEach(t => {
      const tag = document.createElement('div');
      tag.className = `event-tag type-${t.type}`;
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

function renderDuelist() {
  duelistList.innerHTML = '';
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const upcoming = tasks
    .filter(t => {
      if (!t.dueDate) return true;
      return new Date(t.dueDate) >= now;
    })
    .sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });

  if (upcoming.length === 0) {
    duelistList.innerHTML = `
      <div class="empty-state">
        <p>All clear!</p>
        <small>No upcoming deadlines right now.</small>
      </div>
    `;
    return;
  }

  upcoming.forEach((t, index) => {
    const card = document.createElement('div');
    card.className = `task-card type-${t.type}`;
    if (t.completed) card.classList.add('completed');

    card.classList.add('animate-stagger');
    card.style.animationDelay = `${index * 60}ms`;

    const checkbox = document.createElement('div');
    checkbox.className = `task-checkbox${t.completed ? ' checked' : ''}`;
    checkbox.addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggleComplete(t.id);
    });

    const title = document.createElement('h3');
    title.textContent = t.title;

    const badge = document.createElement('span');
    badge.className = `task-type-badge type-${t.type}`;
    badge.textContent = t.type;

    const header = document.createElement('div');
    header.className = 'task-card-header';
    header.appendChild(checkbox);
    header.appendChild(title);
    header.appendChild(badge);

    card.appendChild(header);

    const metaParts = [];
    if (t.dueDate) {
      const formatted = new Date(t.dueDate).toLocaleString([], {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      metaParts.push(`<span>${formatted}</span>`);
    }
    if (t.location) {
      metaParts.push(`<span>${t.location}</span>`);
    }
    if (metaParts.length) {
      const meta = document.createElement('p');
      meta.className = 'task-meta';
      meta.innerHTML = metaParts.join('');
      card.appendChild(meta);
    }

    if (t.description) {
      const desc = document.createElement('p');
      desc.className = 'task-desc';
      desc.textContent = t.description;
      card.appendChild(desc);
    }

    card.addEventListener('click', () => openEditModal(t));
    attachLongPress(card, (e) => showContextMenu(e, t));
    duelistList.appendChild(card);
  });
}

async function toggleComplete(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  try {
    const taskRef = doc(db, 'tasks', id);
    await updateDoc(taskRef, {
      completed: !task.completed
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
  document.getElementById('task-location').value = task.location || '';
  document.getElementById('task-desc').value = task.description || '';
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
  const id = document.getElementById('task-id').value;
  const payload = {
    title: document.getElementById('task-title').value,
    type: document.getElementById('task-type').value,
    dueDate: document.getElementById('task-date').value,
    location: document.getElementById('task-location').value,
    description: document.getElementById('task-desc').value,
    completed: false
  };

  try {
    if (id) {
      const taskRef = doc(db, 'tasks', id);
      await updateDoc(taskRef, payload);
    } else {
      await addDoc(tasksCol, {
        ...payload,
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

let setupMinutes = 45;
let isDraggingDial = false;

function setSetupDialValue(mins) {
  setupMinutes = mins;
  if(zoneDialValue) zoneDialValue.textContent = mins;
  const deg = (mins / 120) * 360;
  if(zoneDialRotator) zoneDialRotator.style.transform = `rotate(${deg}deg)`;
  if (setupDialProgress) {
    const offset = SETUP_RING_CIRC - (mins / 120) * SETUP_RING_CIRC;
    setupDialProgress.style.strokeDashoffset = offset;
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
  if (mins !== setupMinutes) setSetupDialValue(mins);
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
function updateZoneDisplay() { const h = Math.floor(zoneRemainingSeconds / 3600); const m = Math.floor((zoneRemainingSeconds % 3600) / 60); const s = zoneRemainingSeconds % 60; if (h > 0) zoneTimeEl.textContent = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; else zoneTimeEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; }
function updateRingProgress() { const fraction = zoneRemainingSeconds / zoneTotalSeconds; const offset = RING_CIRCUMFERENCE * (1 - fraction); zoneRingProgress.style.strokeDashoffset = offset; }
function updatePauseIcon() { const iconPause = zonePauseBtn.querySelector('.icon-pause'); const iconPlay = zonePauseBtn.querySelector('.icon-play'); if (zoneIsPaused) { iconPause.classList.add('hidden'); iconPlay.classList.remove('hidden'); } else { iconPause.classList.remove('hidden'); iconPlay.classList.add('hidden'); } }

// ── Touch Utilities ──
const LONG_PRESS_DURATION = 500;
function attachLongPress(element, callback) {
  let timer = null; let didLongPress = false;
  const start = (e) => { 
    didLongPress = false; 
    element.classList.add('long-pressing'); 
    timer = setTimeout(() => { 
      didLongPress = true; 
      element.classList.remove('long-pressing'); 
      if (navigator.vibrate) navigator.vibrate(30); 
      callback(e); 
    }, LONG_PRESS_DURATION); 
  };
  const cancel = () => { clearTimeout(timer); element.classList.remove('long-pressing'); };
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
  toggleItem.textContent = task.completed ? 'Mark Incomplete' : 'Mark Complete'; 
  toggleItem.addEventListener('click', () => { dismissContextMenu(); toggleComplete(task.id); });
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

init();
