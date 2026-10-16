import type { ChangesDocType } from '@/Schema'

// What a participant started the day as, worked out from the data we already keep:
// the start time the importer stored, the course in the first logged course change,
// and the "old" side of the first logged e-punch change.

export interface OriginalStart {
    course: string
    time: string
}

export interface OriginalEpunch {
    epunch: string
    // Only known for changes logged as "<epunch>, Rental:<true|false>".
    isRental: boolean | undefined
}

function earliestChange(changes: ChangesDocType[], participantId: string, changeType: string): ChangesDocType | undefined {
    let best: ChangesDocType | undefined
    for (const c of changes) {
        if (c.participantId !== participantId || c.changeType !== changeType) {continue}
        if (best === undefined || c.changedAt < best.changedAt) {best = c}
    }
    return best
}

export function getOriginalStart(
    participantId: string,
    originalStartTime: string | undefined,
    currentCourse: string,
    changes: ChangesDocType[]
): OriginalStart | undefined {
    if (!originalStartTime) {return undefined}
    // Course changes are logged as old: "<course> <time>", so the first one names the starting course.
    const firstCourseChange = earliestChange(changes, participantId, 'newCourse')
    const course = (firstCourseChange?.old.split(' ')[0]) || currentCourse
    return {course, time: originalStartTime}
}

export function getOriginalEpunch(participantId: string, changes: ChangesDocType[]): OriginalEpunch | undefined {
    const first = earliestChange(changes, participantId, 'epunch')
    if (first === undefined) {return undefined}
    const match = /^(.*), Rental:(true|false)$/.exec(first.old)
    if (match !== null) {
        return {epunch: match[1]!, isRental: match[2] === 'true'}
    }
    return {epunch: first.old, isRental: undefined}
}
