// Small helpers shared by the Start Manager page and its components.

export function isMagicTime(time: string): boolean {
    return time.startsWith('_')
}

// Slot times starting with "_" are internal queues; never show those names to volunteers.
export function formatSlotTime(time: string): string {
    switch (time) {
        case '_needsAssignment':
            return 'Needs a new time'
        case '_notAttending':
            return 'Not attending'
        default:
            return time
    }
}

// "13:09:17" + 8 minutes -> "13:17". Returns '' if the clock string can't be read yet.
export function addMinutesToClock(clock: string, minutes: number): string {
    const match = /^(\d{1,2}):(\d{2})/.exec(clock)
    if (match === null) {
        return ''
    }
    const total = (parseInt(match[1]!, 10) * 60 + parseInt(match[2]!, 10) + minutes) % 1440
    const hh = String(Math.floor(total / 60)).padStart(2, '0')
    const mm = String(total % 60).padStart(2, '0')
    return `${hh}:${mm}`
}

export function timeAgo(thenMs: number, nowMs: number = Date.now()): string {
    const mins = Math.floor((nowMs - thenMs) / 60000)
    if (mins < 1) {
        return 'just now'
    }
    if (mins < 60) {
        return `${mins} min ago`
    }
    return `${Math.floor(mins / 60)} h ${mins % 60} min ago`
}

export function clockHHMM(ms: number): string {
    const d = new Date(ms)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const CHANGE_LABELS: Record<string, string> = {
    noShow: 'No show',
    notAttending: 'Not attending',
    needsAssignment: 'Needs new time',
    newTime: 'New time',
    newCourse: 'New course',
    epunch: 'E-punch',
    competitiveStatus: 'Competitive status',
    repair: 'Record repaired',
}

export function changeTypeLabel(changeType: string): string {
    return CHANGE_LABELS[changeType] ?? changeType
}
