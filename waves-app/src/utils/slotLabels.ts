import type { SlotDocType } from '@/Schema'

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
    wrongEpunch: 'Wrong e-punch',
    notAttending: 'Not attending',
    needsAssignment: 'Needs new time',
    newTime: 'New time',
    newCourse: 'New course',
    epunch: 'E-punch',
    competitiveStatus: 'Competitive status',
    repair: 'Record repaired',
    addedParticipant: 'Added participant',
}

export function changeTypeLabel(changeType: string): string {
    return CHANGE_LABELS[changeType] ?? changeType
}

const COURSE_HINTS: Record<string, string> = {
    c1: 'Elem / Beg',
    c2: 'Middle Sch',
    c3: 'Rookie F / Adv Beg',
    c4: 'Rookie M',
    c5: 'JV F / Int',
    c6: 'JV M',
    c7: 'Varsity',
    c8: 'Short Adv',
    c9: 'Long Adv / Coll',
}

export function courseShortLabel(course: string): string {
    return COURSE_HINTS[course] ?? ''
}

//// 10-minute same-school spacing rule ////

export const SAME_SCHOOL_MIN_GAP_MINUTES = 10

export interface TeammateConflict {
    teammateName: string
    teammateTime: string
    gapMinutes: number
}

export interface EvaluatedOpenSlot {
    slot: SlotDocType
    isPreferred: boolean
    closestConflict?: TeammateConflict
}

export interface StartTimeRecommendation {
    school: string
    evaluatedSlots: EvaluatedOpenSlot[]
    recommendedSlot?: EvaluatedOpenSlot
    teammatesOnCourse: Array<{ name: string; time: string }>
    skippedEarlierSlots: EvaluatedOpenSlot[]
    reason: string
}

export function parseTimeToMinutes(time: string): number | undefined {
    const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
    if (match === null) return undefined
    return parseInt(match[1]!, 10) * 60 + parseInt(match[2]!, 10)
}

export function normalizeSchoolName(club: string | undefined): string {
    if (!club) return ''
    const trimmed = club.trim()
    const lower = trimmed.toLowerCase()
    if (lower === '' || lower === 'unknown' || lower === 'none' || lower === 'independent / no school') {
        return ''
    }
    return trimmed
}

export function evaluateStartTimesForSchool(params: {
    openSlots: SlotDocType[]
    allSlots: SlotDocType[]
    allParticipants: Array<{ id: string; name: string; club?: string }>
    course: string
    participantClub: string | undefined
    excludeParticipantId?: string
}): StartTimeRecommendation {
    const { openSlots, allSlots, allParticipants, course, participantClub, excludeParticipantId } = params
    const school = normalizeSchoolName(participantClub)
    const schoolLower = school.toLowerCase()

    const participantById = new Map(allParticipants.map((p) => [p.id, p]))

    // Find all teammates from the same school who are currently assigned a real start time on this course
    const teammatesWithMinutes: Array<{ name: string; time: string; minutes: number }> = []
    if (school !== '') {
        for (const s of allSlots) {
            if (s.course !== course || isMagicTime(s.time)) continue
            const mins = parseTimeToMinutes(s.time)
            if (mins === undefined) continue
            for (const pid of s.participants) {
                if (pid === excludeParticipantId) continue
                const p = participantById.get(pid)
                if (p !== undefined && normalizeSchoolName(p.club).toLowerCase() === schoolLower) {
                    teammatesWithMinutes.push({ name: p.name, time: s.time, minutes: mins })
                }
            }
        }
    }
    teammatesWithMinutes.sort((a, b) => a.time.localeCompare(b.time) || a.name.localeCompare(b.name))
    const teammatesOnCourse = teammatesWithMinutes.map(({ name, time }) => ({ name, time }))

    const evaluatedSlots: EvaluatedOpenSlot[] = openSlots.map((slot) => {
        const slotMins = parseTimeToMinutes(slot.time)
        if (school === '' || teammatesWithMinutes.length === 0 || slotMins === undefined) {
            return { slot, isPreferred: true }
        }

        let closest: TeammateConflict | undefined
        for (const tm of teammatesWithMinutes) {
            const gap = Math.abs(slotMins - tm.minutes)
            if (closest === undefined || gap < closest.gapMinutes) {
                closest = {
                    teammateName: tm.name,
                    teammateTime: tm.time,
                    gapMinutes: gap,
                }
            }
        }

        if (closest !== undefined && closest.gapMinutes < SAME_SCHOOL_MIN_GAP_MINUTES) {
            return { slot, isPreferred: false, closestConflict: closest }
        }
        return { slot, isPreferred: true }
    })

    if (evaluatedSlots.length === 0) {
        return {
            school,
            evaluatedSlots,
            recommendedSlot: undefined,
            teammatesOnCourse,
            skippedEarlierSlots: [],
            reason: 'No open start times available in this range.',
        }
    }

    if (school === '') {
        const first = evaluatedSlots[0]!
        return {
            school,
            evaluatedSlots,
            recommendedSlot: first,
            teammatesOnCourse,
            skippedEarlierSlots: [],
            reason: `Soonest open time on ${course} (independent runner — no school spacing needed).`,
        }
    }

    if (teammatesOnCourse.length === 0) {
        const first = evaluatedSlots[0]!
        return {
            school,
            evaluatedSlots,
            recommendedSlot: first,
            teammatesOnCourse,
            skippedEarlierSlots: [],
            reason: `Soonest open time — no other ${school} racers are currently on ${course}.`,
        }
    }

    const firstPreferredIdx = evaluatedSlots.findIndex((e) => e.isPreferred)
    if (firstPreferredIdx >= 0) {
        const recommended = evaluatedSlots[firstPreferredIdx]!
        const skippedEarlierSlots = evaluatedSlots.slice(0, firstPreferredIdx)

        if (skippedEarlierSlots.length > 0) {
            const conflictNames = [
                ...new Set(
                    skippedEarlierSlots
                        .map((s) =>
                            s.closestConflict
                                ? `${s.closestConflict.teammateName} at ${s.closestConflict.teammateTime}`
                                : ''
                        )
                        .filter((x) => x !== '')
                ),
            ].join(', ')
            const skippedTimes = skippedEarlierSlots.map((s) => s.slot.time).join(', ')
            return {
                school,
                evaluatedSlots,
                recommendedSlot: recommended,
                teammatesOnCourse,
                skippedEarlierSlots,
                reason: `Keeps at least 10 minutes between ${school} teammates on ${course} (${conflictNames}). Skipped ${skippedTimes} (<10 min apart), or click any time below to override.`,
            }
        }

        const teammateSummary = teammatesOnCourse.map((t) => `${t.name} at ${t.time}`).join(', ')
        return {
            school,
            evaluatedSlots,
            recommendedSlot: recommended,
            teammatesOnCourse,
            skippedEarlierSlots: [],
            reason: `Soonest open time and 10+ minutes apart from ${school} teammates on ${course} (${teammateSummary}).`,
        }
    }

    // Fallback when every open slot is within 10 minutes of a teammate: pick the one with the largest gap
    let bestFallback = evaluatedSlots[0]!
    for (const candidate of evaluatedSlots) {
        const candGap = candidate.closestConflict?.gapMinutes ?? 0
        const bestGap = bestFallback.closestConflict?.gapMinutes ?? 0
        if (candGap > bestGap) {
            bestFallback = candidate
        }
    }
    const c = bestFallback.closestConflict!
    return {
        school,
        evaluatedSlots,
        recommendedSlot: bestFallback,
        teammatesOnCourse,
        skippedEarlierSlots: evaluatedSlots,
        reason: `No open times on ${course} have a full 10-minute gap from ${school} teammates. Closest to 10 min is ${bestFallback.slot.time} (${c.gapMinutes} min from ${c.teammateName} at ${c.teammateTime}). Click any time to override.`,
    }
}
