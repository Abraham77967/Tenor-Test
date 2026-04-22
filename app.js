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

const views = ['tasks', 'calendar', 'countdown', 'zone'];
let activeViewIndex = 0;
const viewContainer = document.getElementById('view-container');
const tabBar = document.getElementById('tab-bar');
const tabItems = tabBar.querySelectorAll('.tab-item');

function switchView(viewName) {
  const idx = views.indexOf(viewName);
  if (idx === -1) return;
  activeViewIndex = idx;
  
  // 3 views = 100% / 3 = 33.333% per view
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

// ── Init ──
async function init() {
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

      // Check if finished specifically for this day
      const isFinished = t.completedDates && t.completedDates.includes(dateStr);
      return { ...t, isInstanceFinished: isFinished, instanceDate: dateStr };
    }).filter(t => t !== null);

    dayTasks.forEach(t => {
      const tag = document.createElement('div');
      tag.className = `event-tag type-${t.type}`;
      if (t.isInstanceFinished) tag.style.opacity = '0.4'; // Dim finished recurring instances
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
  const dateStrToday = now.toISOString().slice(0, 10);
  now.setHours(0, 0, 0, 0);

  // Generate instances for upcoming tasks (including recurring ones and no-date tasks)
  let instances = [];
  tasks.forEach(t => {
    const tStart = t.dueDate ? t.dueDate.slice(0, 10) : null;
    
    // No-date tasks: Always show in duelist
    if (!tStart) {
      if (!t.completedDates?.includes('flexible')) { // using 'flexible' as a placeholder completion key
        instances.push({ ...t, instanceDate: null, isInstanceFinished: false });
      }
      return;
    }

    if (t.recurrence === 'none') {
      if (new Date(tStart) >= now) {
        instances.push({ ...t, instanceDate: tStart, isInstanceFinished: t.completedDates?.includes(tStart) });
      }
    } else {
      const taskStartDay = new Date(tStart);
      let lookAhead = new Date(now);
      
      // Look ahead up to 14 days to find the next occurrence
      for (let i = 0; i < 14; i++) {
        let checkDate = new Date(lookAhead);
        checkDate.setDate(lookAhead.getDate() + i);
        let checkDateStr = checkDate.toISOString().slice(0, 10);
        
        if (checkDateStr < tStart) continue;

        let match = false;
        if (t.recurrence === 'daily') match = true;
        else if (t.recurrence === 'weekly') match = checkDate.getDay() === taskStartDay.getDay();

        if (match) {
          const finished = t.completedDates?.includes(checkDateStr);
          if (checkDateStr === dateStrToday && finished) continue;
          instances.push({ ...t, instanceDate: checkDateStr, isInstanceFinished: finished });
          break; // only show next one
        }
      }
    }
  });

  instances.sort((a, b) => {
    if (!a.instanceDate) return -1; // null dates at top
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

  instances.slice(0, 15).forEach((t, index) => {
    const card = document.createElement('div');
    card.className = `task-card type-${t.type}`;
    if (t.isInstanceFinished) card.classList.add('completed');

    card.classList.add('animate-stagger');
    card.style.animationDelay = `${index * 60}ms`;

    const checkbox = document.createElement('div');
    checkbox.className = `task-checkbox${t.isInstanceFinished ? ' checked' : ''}`;
    checkbox.addEventListener('click', async (e) => {
      e.stopPropagation();
      await toggleComplete(t.id, t.instanceDate);
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
    if (t.instanceDate) {
      const formatted = new Date(t.instanceDate).toLocaleString([], {
        weekday: 'short', month: 'short', day: 'numeric'
      });
      metaParts.push(`<span>${formatted}</span>`);
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

async function toggleComplete(id, dateStr) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  
  let currentCompleted = task.completedDates || [];
  if (currentCompleted.includes(dateStr)) {
    currentCompleted = currentCompleted.filter(d => d !== dateStr);
  } else {
    currentCompleted.push(dateStr);
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
  const id = document.getElementById('task-id').value;
  const payload = {
    title: document.getElementById('task-title').value,
    type: document.getElementById('task-type').value,
    dueDate: document.getElementById('task-date').value,
    description: document.getElementById('task-desc').value,
    recurrence: document.getElementById('task-repeat').value
  };

  try {
    if (id) {
      const taskRef = doc(db, 'tasks', id);
      await updateDoc(taskRef, payload);
    } else {
      await addDoc(tasksCol, {
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

// ── Custom Select Logic ──
function initCustomSelects() {
  const selects = document.querySelectorAll('.custom-select');
  
  selects.forEach(select => {
    const trigger = select.querySelector('.select-trigger');
    const options = select.querySelector('.select-options');
    const hiddenInput = select.querySelector('input[type="hidden"]');
    const displaySpan = trigger.querySelector('span');

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllCustomSelects(select);
      select.classList.toggle('active');
      options.classList.toggle('hidden');
    });

    options.querySelectorAll('.option').forEach(opt => {
      opt.addEventListener('click', () => {
        const val = opt.dataset.value;
        const text = opt.textContent;
        
        hiddenInput.value = val;
        displaySpan.textContent = text;
        
        options.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        
        select.classList.remove('active');
        options.classList.add('hidden');
      });
    });
  });

  document.addEventListener('click', () => closeAllCustomSelects());
}

function closeAllCustomSelects(except = null) {
  document.querySelectorAll('.custom-select').forEach(s => {
    if (s !== except) {
      s.classList.remove('active');
      s.querySelector('.select-options').classList.add('hidden');
    }
  });
}

function updateCustomSelectUI(id, value) {
  const select = document.getElementById(id).closest('.custom-select');
  const opt = select.querySelector(`.option[data-value="${value}"]`);
  if (opt) opt.click();
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

let dpSelectedDate = new Date(); // Year, Month, Day
let dpSelectedTime = { hrs: 9, mins: 0, ampm: 'AM' };
let dpViewingDate = new Date(); // For month navigation
let dpTimeMode = 'hrs'; // 'hrs' or 'mins'
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

  // Dial Interaction
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
  const count = dpTimeMode === 'hrs' ? 12 : 12; // Show only 12 intervals (0, 5, 10...) for mins
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
    // Snap to 5 mins? Optional. Let's do free movement but tactile every 5.
    if (m !== dpSelectedTime.mins) { 
      dpSelectedTime.mins = m; 
      if (m % 5 === 0 && navigator.vibrate) navigator.vibrate(2);
    }
  }
  updateDPTimeUI();
}

// ── Integration with core Modals ──
// Override original openAdd/Edit modal to reset custom components
const originalOpenAdd = openAddModal;
openAddModal = function(defaultDate) {
  originalOpenAdd(defaultDate);
  updateCustomSelectUI('task-type', 'Homework');
  updateCustomSelectUI('task-repeat', 'none');
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
  updateCustomSelectUI('task-type', task.type);
  updateCustomSelectUI('task-repeat', task.recurrence || 'none');
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

// ── Sub-tab Switcher logic removed ──

// ── Quick Add Logic ──
function initQuickAdd() {
  const input = document.getElementById('quick-add-input');
  const submit = document.getElementById('quick-add-submit');

  const add = async () => {
    const title = input.value.trim();
    if (!title) return;
    
    try {
      await addDoc(collection(db, 'tasks'), {
        title,
        type: 'Homework',
        dueDate: null, // Quick add = no due date
        recurrence: 'none',
        completed: false,
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

// ── Daily Reminders (Habits) Logic ──
let reminders = [];
let currentHabitIndex = 0;
let habitResetInterval = null;
let statsViewingDate = new Date();

function initReminders() {
  const q = query(collection(db, 'reminders'), orderBy('createdAt', 'asc'));
  onSnapshot(q, (snapshot) => {
    reminders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (currentHabitIndex >= reminders.length) currentHabitIndex = Math.max(0, reminders.length - 1);
    renderHeroHabit();
    renderHabitManager();
    if(document.getElementById('habit-stats-modal').classList.contains('visible')) renderHabitStats();
  });

  // Settings Panel Toggle
  const settingsBtn = document.getElementById('habit-settings-btn');
  const managePanel = document.getElementById('habit-manage-panel');
  settingsBtn.addEventListener('click', () => {
    managePanel.classList.toggle('hidden');
  });

  // Add Habit
  const input = document.getElementById('add-reminder-input');
  const submit = document.getElementById('add-reminder-submit');
  const add = async () => {
    const title = input.value.trim();
    if (!title) return;
    try {
      await addDoc(collection(db, 'reminders'), {
        title, completedDates: [], createdAt: serverTimestamp()
      });
      input.value = '';
      if (navigator.vibrate) navigator.vibrate(10);
    } catch (e) {
      console.error("Error adding habit:", e);
    }
  };
  if(input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  if(submit) submit.addEventListener('click', add);

  // Hero Habit Navigation
  document.getElementById('habit-prev').addEventListener('click', () => {
    if(reminders.length < 2) return;
    currentHabitIndex = (currentHabitIndex - 1 + reminders.length) % reminders.length;
    renderHeroHabit();
  });
  document.getElementById('habit-next').addEventListener('click', () => {
    if(reminders.length < 2) return;
    currentHabitIndex = (currentHabitIndex + 1) % reminders.length;
    renderHeroHabit();
  });

  // Hero Check
  document.getElementById('hero-check-btn').addEventListener('click', () => {
    const rem = reminders[currentHabitIndex];
    if(!rem) return;
    const today = new Date().toISOString().split('T')[0];
    toggleReminderCustom(rem, today);
  });

  // Reset Timer Start
  if(habitResetInterval) clearInterval(habitResetInterval);
  habitResetInterval = setInterval(updateHeroCountdown, 1000);
  updateHeroCountdown();

  // Habit Stats Modal
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
  const today = new Date().toISOString().split('T')[0];
  const isDoneToday = rem.completedDates && rem.completedDates.includes(today);

  document.getElementById('hero-habit-title').textContent = rem.title;
  
  const checkBtn = document.getElementById('hero-check-btn');
  if (isDoneToday) {
    checkBtn.classList.add('completed');
  } else {
    checkBtn.classList.remove('completed');
  }
  
  // Hide arrows if only 1 habit
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
    item.innerHTML = `<span>${rem.title}</span> <button>Delete</button>`;
    item.querySelector('button').addEventListener('click', (e) => {
      e.stopPropagation();
      if(confirm(`Delete habit "${rem.title}"?`)) {
        deleteDoc(doc(db, 'reminders', rem.id));
      }
    });
    list.appendChild(item);
  });
}

function updateHeroCountdown() {
  const now = new Date();
  const reset = new Date();
  reset.setHours(24, 0, 0, 0); // Midnight
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
  
  await updateDoc(ref, { completedDates: newDates });
}

function renderHabitStats() {
  if(reminders.length === 0) return;
  const rem = reminders[currentHabitIndex];
  
  document.getElementById('stat-total-checks').textContent = rem.completedDates ? rem.completedDates.length : 0;
  
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
    
    // Check if this date is completed
    const loopDate = new Date(y, m, i);
    // Format YYYY-MM-DD local time directly to match splits
    const yy = loopDate.getFullYear();
    const mm = String(loopDate.getMonth()+1).padStart(2,'0');
    const dd = String(loopDate.getDate()).padStart(2,'0');
    const dateStr = `${yy}-${mm}-${dd}`;
    
    if (rem.completedDates && rem.completedDates.includes(dateStr)) {
      d.style.background = 'rgba(139, 92, 246, 0.2)';
      d.style.borderColor = '#8B5CF6';
      d.style.color = '#fff';
    }
    
    d.addEventListener('click', () => {
      toggleReminderCustom(rem, dateStr);
    });
    
    grid.appendChild(d);
  }
}

// ── Refactored View Switcher ──
const originalInit = init;
init = async function() {
  await originalInit();
  initQuickAdd();
  initReminders();
  initCountdowns();
};

initCustomSelects();
initDatePicker();
renderDPDialNumbers();
init();

// ══════════════════════════════════════════════
//  COUNTDOWN LOGIC
// ══════════════════════════════════════════════
let countdowns = [];
let activeCdInterval = null;

function initCountdowns() {
  const q = query(collection(db, 'countdowns'), orderBy('targetDate', 'asc'));
  onSnapshot(q, (snapshot) => {
    countdowns = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderCountdowns();
  });

  const btnAdd = document.getElementById('add-countdown-btn');
  const modal = document.getElementById('countdown-modal');
  const closeBtn = document.querySelector('.close-cd-btn');
  const form = document.getElementById('countdown-form');
  const backBtn = document.getElementById('cd-back-btn');
  const deleteBtn = document.getElementById('delete-cd-btn');
  
  btnAdd.addEventListener('click', () => {
    document.getElementById('cd-id').value = '';
    form.reset();
    document.getElementById('cd-date').value = '';
    document.getElementById('cd-date-display').textContent = 'Select date & time';
    document.getElementById('cd-modal-title').textContent = 'Add Countdown';
    deleteBtn.classList.add('hidden');
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
    const id = document.getElementById('cd-id').value;
    const title = document.getElementById('cd-title').value;
    const targetDate = document.getElementById('cd-date').value;
    
    if (id) {
      await updateDoc(doc(db, 'countdowns', id), { title, targetDate });
    } else {
      await addDoc(collection(db, 'countdowns'), { title, targetDate, createdAt: serverTimestamp() });
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
    list.innerHTML = `<div class="empty-state"><p>No target events yet.</p><small>Add a date to look forward to!</small></div>`;
    return;
  }

  countdowns.forEach(cd => {
    const target = new Date(cd.targetDate).getTime();
    let diff = target - now;
    if (diff < 0) diff = 0;
    const daysLeft = Math.floor(diff / (1000 * 60 * 60 * 24));

    const card = document.createElement('div');
    card.className = 'countdown-card';
    card.innerHTML = `
      <div class="cd-title">${cd.title}</div>
      <div class="cd-stats">
        <span class="cd-days-val">${daysLeft}</span>
        <span class="cd-days-lbl">Days</span>
      </div>
    `;
    card.addEventListener('click', () => openCountdownDetail(cd));
    
    // Add long press to edit
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

