let events = [];
let tasks = [];
let currentFilter = 'future';
const NO_EVENT_PROGRESS_WINDOW_DAYS = 30;

function parseEventDate(dateVal) {
    if (dateVal === null || typeof dateVal === 'undefined') return null;
    if (typeof dateVal === 'number') {
        const d = new Date(dateVal * 1000);
        return isNaN(d.getTime()) ? null : d;
    }
    if (typeof dateVal === 'string' && /^\d+$/.test(dateVal)) {
        const n = parseInt(dateVal, 10);
        const d = new Date(n * 1000);
        return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? null : d;
}

function loadEvents() {
    return $.ajax({ url: 'events.json', dataType: 'text' }).then(function (txt) {
        try {
            const cleaned = txt.split('\n').filter(line => !line.trim().startsWith('//')).join('\n');
            events = JSON.parse(cleaned);
            events = events.filter(e => e && (typeof e.id !== 'undefined') && e.title);
        } catch (err) {
            console.error(err);
            events = [];
            $('#events-list').html('<div class="text-center text-muted">Не удалось загрузить события</div>');
        }
    }).fail(function (jqXHR, status, err) {
        console.error('Failed to load events.json', status, err);
        events = [];
        $('#events-list').html('<div class="text-center text-muted">Не удалось загрузить события</div>');
    });
}

function loadTasks() {
    return $.ajax({ url: 'tasks.json', dataType: 'text' }).then(function (txt) {
        try {
            const cleaned = txt.split('\n').filter(line => !line.trim().startsWith('//')).join('\n');
            tasks = JSON.parse(cleaned);
            tasks = tasks.filter(t => t && (typeof t.eventId !== 'undefined') && t.title);
        } catch (err) {
            console.warn('No tasks.json or failed to parse — starting with empty tasks', err);
            tasks = [];
        }
    }).fail(function () {
        tasks = [];
    });
}

function renderTasksForEvent(eventId) {
    const t = tasks.filter(x => x.eventId === eventId);
    if (t.length === 0) return '';
    return t.map(task => {
        const status = String(task.status || '?');
        const safeTitle = escapeHtml(task.title || '');
        const labels = { todo: 'В процессе', doing: 'Выполняется', done: 'Выполнено' };
        const displayLabel = labels[status] || status;
        const safeDisplay = escapeHtml(displayLabel);
        return `
                <span class="task-badge">
                    <span class="task-title">${safeTitle}</span>
                    <span class="task-status task-status-${escapeHtml(status)}">${safeDisplay}</span>
                </span>
            `;
    }).join('');
}

function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function updateTimeline() {
    const now = new Date();
    const futureEvents = events
        .filter(e => {
            const d = parseEventDate(e.date);
            return d === null || d > now;
        })
        .sort((a, b) => {
            const da = parseEventDate(a.date);
            const db = parseEventDate(b.date);
            if (da === null && db === null) return 0;
            if (da === null) return 1;
            if (db === null) return -1;
            return da - db;
        });

    if (futureEvents.length > 0) {
        const nextEvent = futureEvents[0];
        const nextDate = parseEventDate(nextEvent.date);
        $('#next-event-title').text(`До события "${nextEvent.title}" осталось...`);
        if (nextDate) {
            const remainingMs = nextDate - now;
            $('#countdown').text(formatDuration(remainingMs));
        } else {
            $('#countdown').text('Дата будет объявлена');
        }
    } else {
        const pastEvents = events
            .filter(e => parseEventDate(e.date) !== null && parseEventDate(e.date) <= now)
            .sort((a, b) => parseEventDate(b.date) - parseEventDate(a.date));
        if (pastEvents.length > 0) {
            const last = pastEvents[0];
            const lastDate = parseEventDate(last.date);
            $('#next-event-title').text(`С момента события "${last.title}" прошло...`);
            const elapsed = now - lastDate;
            $('#countdown').text(formatDuration(elapsed));
        } else {
            $('#next-event-title').text('Событий нет');
            $('#countdown').text('');
        }
    }
}

function formatDuration(ms) {
    if (ms <= 0) return '0с';
    const totalSec = Math.floor(ms / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    const parts = [];
    if (days) parts.push(days + 'д');
    if (hours) parts.push(hours + 'ч');
    if (minutes) parts.push(minutes + 'м');
    parts.push(seconds + 'с');
    return parts.join(' ');
}

function renderEvents(type) {
    currentFilter = type;
    const $listContainer = $('#events-list');
    const now = new Date();
    $listContainer.empty();

    let filtered = [];
    if (type === 'future') {
        filtered = events.filter(e => {
            const d = parseEventDate(e.date);
            return d === null || d >= now;
        });
    } else if (type === 'past') {
        filtered = events.filter(e => {
            const d = parseEventDate(e.date);
            return d !== null && d < now;
        });
    } else {
        filtered = events.slice();
    }

    filtered = filtered.sort((a, b) => {
        const da = parseEventDate(a.date);
        const db = parseEventDate(b.date);
        if (da === null && db === null) return 0;
        if (da === null) return 1;
        if (db === null) return -1;
        return da - db;
    });

    if (filtered.length === 0) {
        $listContainer.html('<div class="text-center text-muted">Список пуст</div>');
        return;
    }

    filtered.forEach(event => {
        const parsed = parseEventDate(event.date);
        const dateStr = parsed
            ? parsed.toLocaleString('ru-RU', { year: 'numeric', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
            : 'TBA';
        const isPast = parsed ? (parsed < now) : false;
        const badgeClass = parsed ? (isPast ? 'bg-secondary' : 'bg-primary') : 'bg-secondary';
        const $card = $(
            `<div class="card event-card mb-3 shadow-sm ${isPast ? 'past' : ''}">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center">
                            <h5 class="card-title mb-1">${escapeHtml(event.title)}</h5>
                            <span class="badge ${badgeClass}">${dateStr}</span>
                        </div>
                        <p class="card-text text-muted small">${escapeHtml(event.desc || '')}</p>
                        <div class="mt-2" id="tasks-for-${event.id}">${renderTasksForEvent(event.id)}</div>
                    </div>
                </div>`
        );
        $listContainer.append($card);
    });
    initTooltips();
}

function initTooltips() {
    try {
        $('[data-bs-toggle="tooltip"]').each(function () {
            if (!this._tooltip) this._tooltip = new bootstrap.Tooltip(this);
        });
    } catch (e) {
        console.warn('Tooltip init failed', e);
    }
}

function initFilters() {
    $(document).on('click', '.filter-button', function () {
        const filter = $(this).data('filter');
        if (!filter) return;
        $('.filter-button').removeClass('active');
        $(this).addClass('active');
        renderEvents(filter);
    });
}

$(function () {
    const hasTimer = $('#countdown').length && $('#next-event-title').length;
    const hasEventList = $('#events-list').length;

    if (hasEventList) {
        initFilters();
    }

    const loadPromises = [loadEvents()];
    if (hasEventList) {
        loadPromises.push(loadTasks());
    }

    $.when.apply($, loadPromises).always(function () {
        if (hasTimer) {
            updateTimeline();
            setInterval(updateTimeline, 1000);
        }
        if (hasEventList) {
            renderEvents('future');
        }
    });
});
