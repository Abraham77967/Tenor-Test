const API_URL = '/api/tasks';
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
  // Each view is 50% of the 200%-wide container
  viewContainer.style.transform = `translateX(-${idx * 50}%)`;

  tabItems.forEach(t => {
    t.classList.toggle('active', t.dataset.view === viewName);
  });
}

// Tab clicks
tabItems.forEach(tab => {
  tab.addEventListener('click', () => switchView(tab.dataset.view));
});

// ── Swipe Gesture (horizontal between views) ──
let swipeStartX = 0;
let swipeStartY = 0;
let swipeDelta = 0;
let isSwiping = false;
const SWIPE_THRESHOLD = 50;

viewContainer.addEventListener('touchstart', (e) => {
  // Don't hijack swipe inside scrollable areas that need vertical scroll
  swipeStartX = e.touches[0].clientX;
  swipeStartY = e.touches[0].clientY;
  swipeDelta = 0;
  isSwiping = false;
}, { passive: true });

viewContainer.addEventListener('touchmove', (e) => {
  const dx = e.touches[0].clientX - swipeStartX;
  const dy = e.touches[0].clientY - swipeStartY;

  // Determine if this is a horizontal swipe (only on first significant move)
  if (!isSwiping && Math.abs(dx) > 10) {
    // If more horizontal than vertical, treat as swipe
    if (Math.abs(dx) > Math.abs(dy) * 1.2) {
      isSwiping = true;
      viewContainer.classList.add('swiping');
    }
  }

  if (!isSwiping) return;

  swipeDelta = dx;
  const baseOffset = activeViewIndex * 50;
  const swipePercent = (dx / window.innerWidth) * 50;
  // Clamp so it doesn't go past edges
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
    // Snap back
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
  await fetchTasks();
  renderCalendar();
  renderDuelist();
}

async function fetchTasks() {
  try {
    const res = await fetch(API_URL);
    tasks = await res.json();
  } catch (err) {
    console.error('Failed to load tasks', err);
  }
}

// ── Calendar ──
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

// ── Duelist (Upcoming Tasks) ──
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

    attachLongPress(card, (e) => {
      showContextMenu(e, t);
    });

    duelistList.appendChild(card);
  });
}

// ── Toggle Complete ──
async function toggleComplete(id) {
  try {
    await fetch(`${API_URL}/${id}/toggle`, { method: 'PATCH' });
    await init();
  } catch (err) {
    console.error('Failed to toggle task', err);
  }
}

// ── Month Navigation ──
prevBtn.addEventListener('click', () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar();
});

nextBtn.addEventListener('click', () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar();
});

// ── Modal ──
addTaskBtn.addEventListener('click', () => openAddModal());
closeBtn.addEventListener('click', closeModal);

taskModal.addEventListener('click', (e) => {
  if (e.target === taskModal) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

function openAddModal(defaultDate = null) {
  document.getElementById('task-id').value = '';
  taskForm.reset();

  if (defaultDate) {
    document.getElementById('task-date').value = `${defaultDate}T09:00`;
  }

  document.getElementById('modal-title').textContent = 'Add Task';
  deleteBtn.classList.add('hidden');
  taskModal.classList.remove('hidden');
  requestAnimationFrame(() => {
    taskModal.classList.add('visible');
  });
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
  requestAnimationFrame(() => {
    taskModal.classList.add('visible');
  });
}

function closeModal() {
  taskModal.classList.remove('visible');
  setTimeout(() => {
    taskModal.classList.add('hidden');
  }, 300);
}

// ── Form Submit ──
taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('task-id').value;
  const payload = {
    title: document.getElementById('task-title').value,
    type: document.getElementById('task-type').value,
    dueDate: document.getElementById('task-date').value,
    location: document.getElementById('task-location').value,
    description: document.getElementById('task-desc').value
  };

  const method = id ? 'PUT' : 'POST';
  const url = id ? `${API_URL}/${id}` : API_URL;

  try {
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    closeModal();
    setTimeout(() => init(), 200);
  } catch (err) {
    console.error('Error saving task', err);
  }
});

// ── Delete ──
deleteBtn.addEventListener('click', async () => {
  const id = document.getElementById('task-id').value;
  if (!id) return;

  if (confirm('Delete this task?')) {
    try {
      await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
      closeModal();
      setTimeout(() => init(), 200);
    } catch (err) {
      console.error('Failed to delete', err);
    }
  }
});

// ══════════════════════════════════════════════
//  ZONE TIMER
// ══════════════════════════════════════════════

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

const SETUP_RING_CIRC = 2 * Math.PI * 130; // r=130
if (setupDialProgress) setupDialProgress.style.strokeDasharray = SETUP_RING_CIRC;

const RING_CIRCUMFERENCE = 2 * Math.PI * 90; // r=90
let zoneInterval = null;
let zoneTotalSeconds = 0;
let zoneRemainingSeconds = 0;
let zoneIsPaused = false;

// ── Dial Logic ──
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
  
  // 360 deg = 120 mins
  let mins = Math.round(deg / 3);
  mins = Math.max(5, Math.round(mins / 5) * 5); // snap to 5
  if (mins > 120) mins = 120; // 2 hour max on dial
  // Support 0 dragging cleanly? Min 5 minutes.
  
  if (mins !== setupMinutes) setSetupDialValue(mins);
}

if (zoneDial) {
  setSetupDialValue(45); // init
  
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

// Start button
if (zoneStartBtn) {
  zoneStartBtn.addEventListener('click', () => {
    startZone(setupMinutes * 60);
  });
}

// Pause / Resume
zonePauseBtn.addEventListener('click', () => {
  if (zoneIsPaused) {
    resumeZone();
  } else {
    pauseZone();
  }
});

// Stop
zoneStopBtn.addEventListener('click', () => {
  stopZone();
});

// Dismiss complete overlay
zoneCompleteDismiss.addEventListener('click', () => {
  zoneCompleteOverlay.classList.add('hidden');
});

function startZone(totalSeconds) {
  zoneTotalSeconds = totalSeconds;
  zoneRemainingSeconds = totalSeconds;
  zoneIsPaused = false;

  // Switch to active view
  const container = document.getElementById('zone-container');
  container.classList.remove('zone-mode-setup');
  container.classList.add('zone-mode-active');

  // Reset ring
  zoneRingProgress.style.strokeDasharray = RING_CIRCUMFERENCE;
  zoneRingProgress.style.strokeDashoffset = 0;

  updateZoneDisplay();
  updatePauseIcon();

  // Haptic
  if (navigator.vibrate) navigator.vibrate(30);

  // Start countdown
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

function pauseZone() {
  zoneIsPaused = true;
  zoneLabelEl.textContent = 'paused';
  updatePauseIcon();
}

function resumeZone() {
  zoneIsPaused = false;
  zoneLabelEl.textContent = 'remaining';
  updatePauseIcon();
}

function stopZone() {
  clearInterval(zoneInterval);
  zoneInterval = null;
  zoneIsPaused = false;

  // Switch back to setup
  const container = document.getElementById('zone-container');
  container.classList.remove('zone-mode-active');
  container.classList.add('zone-mode-setup');

  if (navigator.vibrate) navigator.vibrate(20);
}

function onZoneComplete() {
  // Show completion overlay
  const mins = Math.round(zoneTotalSeconds / 60);
  zoneCompleteMsg.textContent = `${mins} minute session completed.`;
  zoneCompleteOverlay.classList.remove('hidden');

  // Haptic celebration
  if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);

  // Reset to setup
  stopZone();
}

function updateZoneDisplay() {
  const h = Math.floor(zoneRemainingSeconds / 3600);
  const m = Math.floor((zoneRemainingSeconds % 3600) / 60);
  const s = zoneRemainingSeconds % 60;

  if (h > 0) {
    zoneTimeEl.textContent = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  } else {
    zoneTimeEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
}

function updateRingProgress() {
  const fraction = zoneRemainingSeconds / zoneTotalSeconds;
  const offset = RING_CIRCUMFERENCE * (1 - fraction);
  zoneRingProgress.style.strokeDashoffset = offset;
}

function updatePauseIcon() {
  const iconPause = zonePauseBtn.querySelector('.icon-pause');
  const iconPlay = zonePauseBtn.querySelector('.icon-play');

  if (zoneIsPaused) {
    iconPause.classList.add('hidden');
    iconPlay.classList.remove('hidden');
  } else {
    iconPause.classList.remove('hidden');
    iconPlay.classList.add('hidden');
  }
}

// ══════════════════════════════════════════════
//  LONG-PRESS HANDLER (touch-friendly)
// ══════════════════════════════════════════════
const LONG_PRESS_DURATION = 500;

function attachLongPress(element, callback) {
  let timer = null;
  let didLongPress = false;

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

  const cancel = () => {
    clearTimeout(timer);
    element.classList.remove('long-pressing');
  };

  element.addEventListener('click', (e) => {
    if (didLongPress) {
      e.stopPropagation();
      e.preventDefault();
      didLongPress = false;
    }
  }, true);

  element.addEventListener('touchstart', start, { passive: true });
  element.addEventListener('touchend', cancel);
  element.addEventListener('touchmove', cancel);
  element.addEventListener('touchcancel', cancel);

  element.addEventListener('mousedown', start);
  element.addEventListener('mouseup', cancel);
  element.addEventListener('mouseleave', cancel);
}

// ══════════════════════════════════════════════
//  CONTEXT MENU (long-press actions)
// ══════════════════════════════════════════════

function showContextMenu(e, task) {
  dismissContextMenu();

  let x, y;
  if (e.touches && e.touches.length) {
    x = e.touches[0].clientX;
    y = e.touches[0].clientY;
  } else if (e.changedTouches && e.changedTouches.length) {
    x = e.changedTouches[0].clientX;
    y = e.changedTouches[0].clientY;
  } else {
    x = e.clientX || 100;
    y = e.clientY || 100;
  }

  const backdrop = document.createElement('div');
  backdrop.className = 'context-menu-backdrop';
  backdrop.addEventListener('click', dismissContextMenu);
  backdrop.addEventListener('touchstart', dismissContextMenu, { passive: true });
  document.body.appendChild(backdrop);

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.id = 'active-context-menu';

  const editItem = document.createElement('button');
  editItem.className = 'context-menu-item';
  editItem.textContent = 'Edit';
  editItem.addEventListener('click', () => {
    dismissContextMenu();
    openEditModal(task);
  });

  const toggleItem = document.createElement('button');
  toggleItem.className = 'context-menu-item';
  toggleItem.textContent = task.completed ? 'Mark Incomplete' : 'Mark Complete';
  toggleItem.addEventListener('click', async () => {
    dismissContextMenu();
    await toggleComplete(task.id);
  });

  const deleteItem = document.createElement('button');
  deleteItem.className = 'context-menu-item danger';
  deleteItem.textContent = 'Delete';
  deleteItem.addEventListener('click', async () => {
    dismissContextMenu();
    try {
      await fetch(`${API_URL}/${task.id}`, { method: 'DELETE' });
      await init();
    } catch (err) {
      console.error('Failed to delete', err);
    }
  });

  menu.appendChild(editItem);
  menu.appendChild(toggleItem);
  menu.appendChild(deleteItem);

  document.body.appendChild(menu);
  const rect = menu.getBoundingClientRect();
  const finalX = Math.min(x, window.innerWidth - rect.width - 12);
  const finalY = Math.min(y, window.innerHeight - rect.height - 12);
  menu.style.left = `${Math.max(12, finalX)}px`;
  menu.style.top = `${Math.max(12, finalY)}px`;
}

function dismissContextMenu() {
  const existing = document.getElementById('active-context-menu');
  if (existing) existing.remove();
  const backdrop = document.querySelector('.context-menu-backdrop');
  if (backdrop) backdrop.remove();
}

// ══════════════════════════════════════════════
//  BOOT
// ══════════════════════════════════════════════
init();
