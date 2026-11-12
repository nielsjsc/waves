import type { ChangesDocType, ParticipantDocType, SlotDocType } from '@/Schema'
import { hasNoShow } from './styleHelpers'

// Small helpers shared by the Start Manager page and its components.

export function isMagicTime(time: string): boolean {
    return time.startsWith('_')
}

// Slot times starting with "_" are internal queues; never show those names to volunteers.
export function formatSlotTime(time: string): string {
    switch (time) {
        case '_needsAssignment':
            return 'Standby'
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
    needsAssignment: 'Standby',
    newTime: 'New time',
    newCourse: 'New course',
    epunch: 'E-punch',
    competitiveStatus: 'Competitive status',
    groupSize: 'Group size',
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

export interface CourseColorSpec {
    bgHex: string
    textClass: string
    subtextClass: string
}

// Exact single course header colors from the WIOL Excel StartSheet
const COURSE_COLORS: Record<string, CourseColorSpec> = {
    c1: {
        bgHex: '#FFFFFF',
        textClass: 'text-slate-950',
        subtextClass: 'text-slate-700',
    },
    c2: {
        bgHex: '#FFFF00',
        textClass: 'text-slate-950',
        subtextClass: 'text-slate-800',
    },
    c3: {
        bgHex: '#E6B8B7',
        textClass: 'text-slate-950',
        subtextClass: 'text-slate-800',
    },
    c4: {
        bgHex: '#ACA16C',
        textClass: 'text-slate-950',
        subtextClass: 'text-slate-900',
    },
    c5: {
        bgHex: '#9966FF',
        textClass: 'text-slate-950',
        subtextClass: 'text-slate-900',
    },
    c6: {
        bgHex: '#FF9900',
        textClass: 'text-slate-950',
        subtextClass: 'text-slate-900',
    },
    c7: {
        bgHex: '#00B050',
        textClass: 'text-slate-950',
        subtextClass: 'text-slate-900',
    },
    c8: {
        bgHex: '#FF0000',
        textClass: 'text-slate-950',
        subtextClass: 'text-slate-900',
    },
    c9: {
        bgHex: '#00B0F0',
        textClass: 'text-slate-950',
        subtextClass: 'text-slate-900',
    },
}

export function courseHeaderColor(course: string): CourseColorSpec | undefined {
    return COURSE_COLORS[course]
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

//// Standby Matching Algorithm ////

export interface StandbyMatch {
    course: string
    slot: SlotDocType
    noShowParticipant: ParticipantDocType
    standbyParticipants: ParticipantDocType[]
}

export function findStandbyMatches(
    allParticipants: ParticipantDocType[],
    allSlots: SlotDocType[],
    allChanges: ChangesDocType[]
): StandbyMatch[] {
    const participantById = new Map(allParticipants.map((p) => [p.id, p]))

    // Track when each runner entered Standby so the Standby queue is ordered FIFO (longest waiting first)
    const standbyEnteredAt = new Map<string, number>()
    for (const c of allChanges) {
        if (c.changeType === 'needsAssignment') {
            const prev = standbyEnteredAt.get(c.participantId) ?? 0
            if (c.changedAt > prev) {
                standbyEnteredAt.set(c.participantId, c.changedAt)
            }
        }
    }

    const courseByParticipant = new Map<string, string>()
    for (const s of allSlots) {
        for (const pid of s.participants) {
            if (!courseByParticipant.has(pid)) {
                courseByParticipant.set(pid, s.course)
            }
        }
    }

    // Group Standby runners by course in FIFO order
    const standbyByCourse = new Map<string, ParticipantDocType[]>()
    for (const p of allParticipants) {
        if (p.state !== 'needsAssignment') continue
        const course = courseByParticipant.get(p.id)
        if (!course) continue
        const list = standbyByCourse.get(course)
        if (list === undefined) {
            standbyByCourse.set(course, [p])
        } else {
            list.push(p)
        }
    }

    for (const list of standbyByCourse.values()) {
        list.sort(
            (a, b) =>
                (standbyEnteredAt.get(a.id) ?? 0) - (standbyEnteredAt.get(b.id) ?? 0) ||
                a.name.localeCompare(b.name)
        )
    }

    // Find all real start slots on courses with Standby runners where a starter is marked No Show
    const matches: StandbyMatch[] = []
    for (const slot of allSlots) {
        if (isMagicTime(slot.time) || slot.isUsable === false) continue
        const standbyList = standbyByCourse.get(slot.course)
        if (!standbyList || standbyList.length === 0) continue

        for (const pid of slot.participants) {
            const p = participantById.get(pid)
            if (p !== undefined && hasNoShow(p)) {
                matches.push({
                    course: slot.course,
                    slot,
                    noShowParticipant: p,
                    standbyParticipants: standbyList,
                })
            }
        }
    }

    matches.sort((a, b) => a.slot.time.localeCompare(b.slot.time) || a.course.localeCompare(b.course))
    return matches
}

//// Course Headcount Calculation ////

export interface CourseHeadcountSummary {
    totalRegisteredEntries: number
    subtractedNoShowEntries: number
    subtractedNotAttendingEntries: number
    activeEntriesOnCourse: number
    runnersFromIndividualsAndGroups: number
    nonCompetitiveShadows: number
    totalPeopleOnCourse: number
    byCourse: Array<{
        course: string
        activeEntries: number
        runners: number
        shadows: number
        totalPeople: number
    }>
}

export function calculateCourseHeadcount(
    allParticipants: ParticipantDocType[],
    allSlots: SlotDocType[]
): CourseHeadcountSummary {
    const courseByParticipant = new Map<string, string>()
    for (const s of allSlots) {
        for (const pid of s.participants) {
            if (!courseByParticipant.has(pid)) {
                courseByParticipant.set(pid, s.course)
            }
        }
    }

    let subtractedNoShowEntries = 0
    let subtractedNotAttendingEntries = 0
    let activeEntriesOnCourse = 0
    let runnersFromIndividualsAndGroups = 0
    let nonCompetitiveShadows = 0

    const courseStats = new Map<
        string,
        { activeEntries: number; runners: number; shadows: number; totalPeople: number }
    >()

    for (const p of allParticipants) {
        if (p.state === 'notAttending') {
            subtractedNotAttendingEntries += 1
            continue
        }
        if (hasNoShow(p)) {
            subtractedNoShowEntries += 1
            continue
        }

        const runners = Math.max(1, Math.round(Number(p.groupSize) || 1))
        const shadows = p.isNonCompete ? 1 : 0
        const entryTotal = runners + shadows

        activeEntriesOnCourse += 1
        runnersFromIndividualsAndGroups += runners
        nonCompetitiveShadows += shadows

        const course = courseByParticipant.get(p.id) ?? 'unassigned'
        const cur = courseStats.get(course) ?? {
            activeEntries: 0,
            runners: 0,
            shadows: 0,
            totalPeople: 0,
        }
        cur.activeEntries += 1
        cur.runners += runners
        cur.shadows += shadows
        cur.totalPeople += entryTotal
        courseStats.set(course, cur)
    }

    const byCourse = [...courseStats.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([course, stats]) => ({
            course,
            ...stats,
        }))

    return {
        totalRegisteredEntries: allParticipants.length,
        subtractedNoShowEntries,
        subtractedNotAttendingEntries,
        activeEntriesOnCourse,
        runnersFromIndividualsAndGroups,
        nonCompetitiveShadows,
        totalPeopleOnCourse: runnersFromIndividualsAndGroups + nonCompetitiveShadows,
        byCourse,
    }
}
