import Papa, { type ParseResult } from "papaparse"
import type { ParticipantDocType, SlotDocType } from "./Schema"
import {
    EVENT_ID,
    bulkUpsertParticipants,
    bulkUpsertSlots,
    cleanupLegacyDuplicateRecords,
    firstSyncDone,
    isEventEmpty,
    isStaleEvent,
    participantsTanCollection,
    slotsTanCollection,
} from "./database"

// adapted from
// https://dev.to/mahdi_falamarzi/how-to-read-csv-file-in-typescript-react-app-106h

// type PublicRegistrationRecord = {
//     FirstName: string
//     LastName: string
//     Email: string
//     Club: string | undefined
//     Class: string
//     Sex: "M" | "F" | undefined
//     EPunch: string | undefined
//     Rental: boolean
//     StartTime: string | undefined
//     Phone: string | undefined
//     EmergencyPhone: string | undefined
//     CarLicense: string | undefined
//     BirthYear: number
//     Newcomer: boolean | undefined
//     Group: number | undefined
//     Paid: boolean
//     Owed: number | undefined
//     Waiver: boolean
// }

// export function readPublicCSV():void {
//     Papa.parse("/2025-12-20_WL04_UW_PublicReg.csv", {
//         header: true,
//         download: true,
//         skipEmptyLines: true,
//         delimiter: ',',
//         complete: (parsed:ParseResult<PublicRegistrationRecord>) => {
//             insertPublicCsv(parsed.data)
//         },
//     })
//     return
// }

export function getCourseForClass(className:string):string {
    switch (className) {
        case '1':
        case 'W1F':
        case 'W1M':
            return 'c1'; // Beginner + Elementary
        case 'W2F':
        case 'W2M':
            return 'c2'; // Middle School
        case '3':
        case 'W3F':
            return 'c3'; // Advanced Beginner + HS Rookie Girls
        case 'W4M':
            return 'c4'; // HS Rookie Boys
        case '5':
        case 'W5F':
        case 'WICJVF':
        case 'WICJVM':
            return 'c5'; // Intermediate + JV Girls + College JV
        case 'W6M':
            return 'c6'; // JV Boys
        case 'W7F':
        case 'W7M':
            return 'c7'; // Varsity
        case '8O':
        case '8F':
        case '8G':
            return 'c8'; // Short Advanced
        case '9O':
        case '9F':
        case '9G':
        case 'W9F':
        case 'W9M':
            return 'c9'; // Long Advanced + College
        default:
            return className;
    }
}

export function formatStartTime(timeString:string):string {
    let res = timeString;
    if (timeString.endsWith(":00")) {
        res = timeString.slice(0,-3)
    }
    const parts = res.split(":")
    if (parts.length === 2 && parts[0].length === 1) {
        return `0${parts[0]}:${parts[1]}`
    }
    return res;
}

// Fixed IDs derived from (event, course, time) so that if two laptops import
// startlist.csv at the same moment, their documents have identical IDs and
// contents and collapse into one record instead of creating duplicates.
export function slotIdFor(course: string, time: string): string {
    return `${EVENT_ID}-slot-${course}-${time}`
}

export function participantIdFor(course: string, time: string): string {
    return `${EVENT_ID}-participant-${course}-${time}`
}

export type PdfStartListRecord = {
    Time: string,
    "ELEMENTARYBEGINNER.1": string,
    "ELEMENTARYBEGINNER.2": string,
    "ELEMENTARYBEGINNER.3": string,
    "MIDDLE SCHOOL.1": string,
    "MIDDLE SCHOOL.2": string,
    "MIDDLE SCHOOL.3": string,
    "ROOKIE FEMALEADV BEGINNER.1": string,
    "ROOKIE FEMALEADV BEGINNER.2": string,
    "ROOKIE FEMALEADV BEGINNER.3": string,
    "ROOKIE MALE.1": string,
    "ROOKIE MALE.2": string,
    "ROOKIE MALE.3": string,
    "JV FEMALECOLLEGIATE JVINTERMEDIATE.1": string,
    "JV FEMALECOLLEGIATE JVINTERMEDIATE.2": string,
    "JV FEMALECOLLEGIATE JVINTERMEDIATE.3": string,
    "JV MALE.1": string,
    "JV MALE.2": string,
    "JV MALE.3": string,
    "VARSITY.1": string,
    "VARSITY.2": string,
    "VARSITY.3": string,
    "SHORT ADVANCED.1": string,
    "SHORT ADVANCED.2": string,
    "SHORT ADVANCED.3": string,
    "COLLEGE VARSITYLONG ADVANCED.1": string,
    "COLLEGE VARSITYLONG ADVANCED.2": string,
    "COLLEGE VARSITYLONG ADVANCED.3": string
}

let importInFlight: Promise<void> | undefined

export function readStartListCsv(): Promise<void> {
    if (importInFlight !== undefined) {
        return importInFlight
    }
    importInFlight = (async () => {
        const response = await fetch("/startlist.csv", { cache: "no-store" })
        if (!response.ok) {
            throw new Error(`Could not load /startlist.csv (${response.status})`)
        }
        const csvText = await response.text()
        const parsed: ParseResult<PdfStartListRecord> = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            delimiter: ',',
        })
        await insertStartListCsv(parsed.data)
    })().finally(() => {
        importInFlight = undefined
    })
    return importInFlight
}

let autoLoadStarted = false

export function ensureStartListLoaded(): Promise<void> {
    if (autoLoadStarted) {
        return Promise.resolve()
    }
    autoLoadStarted = true
    return (async () => {
        await firstSyncDone
        if (isStaleEvent()) {
            return
        }
        await cleanupLegacyDuplicateRecords()
        if (await isEventEmpty()) {
            console.log(`rxdb: Event ${EVENT_ID} is empty after first sync; importing /startlist.csv...`)
            await readStartListCsv()
        }
    })()
}

export function participantFromStartListData(
    participantId: string,
    col1: string,
    col2: string,
    col3: string
): Omit<ParticipantDocType, 'originalStartTime' | 'startChanged'> | undefined {
    col1 = (col1 ?? '').trim()
    col2 = (col2 ?? '').trim()
    col3 = (col3 ?? '').trim()

    // Support raw multiline cell passed in col1 (e.g. "Name\nSchool\n12345 - NC - N")
    if (col1.includes('\n') && col2 === '' && col3 === '') {
        const lines = col1
            .replace(/_x000D_/g, '')
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean)
        if (lines.length === 2) {
            col1 = lines[0]
            col2 = lines[1]
        } else if (lines.length >= 3) {
            col1 = lines[0]
            col2 = lines.slice(1, -1).join(' ')
            col3 = lines[lines.length - 1]
        }
    }

    if (col1 === '') {
        return undefined
    }

    let name = col1
    if (/^[0-9]+.*/.test(col2) && col3 === '') {
        // move epunch value to col3 if its in col2
        col3 = col2
        col2 = ''
    }

    // Handle "Name Group (x)" on the first line when col2 had no school
    const inlineGroupMatch = /^(.*\S)\s+(Group\s*\(\s*[0-9]+\s*\))$/i.exec(name)
    if (inlineGroupMatch) {
        name = inlineGroupMatch[1].trim()
        if (col2 === '') {
            col2 = inlineGroupMatch[2].trim()
        }
    }

    const isGroup = col2.toLocaleLowerCase().includes('group')
    const groupSize = isGroup ? parseInt(/\(\s*([0-9]+)\s*\)/.exec(col2)?.[1] ?? '1', 10) : 1

    // Strip trailing "(NC)" from school if present and attach to col3
    if (/\(nc\)\s*$/i.test(col2)) {
        col2 = col2.replace(/\s*\(nc\)\s*$/i, '').trim()
        col3 = col3 ? `${col3} - NC` : 'NC'
    }

    const hasClub = !(col2 === '' || isGroup)
    const club = hasClub ? col2 : 'unknown'
    const isRental = /(?:^|[\s\-([]|\d)r(?=[\s\-)\]]|$)/i.test(col3)
    const isNonCompete = /(?:^|[\s\-([*])nc(?=[\s\-)\]*]|$)/i.test(col3)
    const needsWaiver = /(?:^|[\s\-(])n(?=[\s\-)]|$)/i.test(col3)
    const needsPayment = /need\s*\$/i.test(col3)
    const startsNumbers = /^[0-9]+/.test(col3)
    const epunch = startsNumbers ? /^[0-9]+/.exec(col3)?.[0]! : ''

    return {
        id: participantId,
        name: name,
        club: club,
        epunch: epunch,
        isRental: isRental,
        isNonCompete: isNonCompete,
        needsWaiver: needsWaiver,
        needsPayment: needsPayment,
        state: 'waiting',
        groupSize: groupSize,
    }
}

const COURSE_COLUMNS = [
    { course: 'c1', col1: 'ELEMENTARYBEGINNER.1', col2: 'ELEMENTARYBEGINNER.2', col3: 'ELEMENTARYBEGINNER.3' },
    { course: 'c2', col1: 'MIDDLE SCHOOL.1', col2: 'MIDDLE SCHOOL.2', col3: 'MIDDLE SCHOOL.3' },
    { course: 'c3', col1: 'ROOKIE FEMALEADV BEGINNER.1', col2: 'ROOKIE FEMALEADV BEGINNER.2', col3: 'ROOKIE FEMALEADV BEGINNER.3' },
    { course: 'c4', col1: 'ROOKIE MALE.1', col2: 'ROOKIE MALE.2', col3: 'ROOKIE MALE.3' },
    { course: 'c5', col1: 'JV FEMALECOLLEGIATE JVINTERMEDIATE.1', col2: 'JV FEMALECOLLEGIATE JVINTERMEDIATE.2', col3: 'JV FEMALECOLLEGIATE JVINTERMEDIATE.3' },
    { course: 'c6', col1: 'JV MALE.1', col2: 'JV MALE.2', col3: 'JV MALE.3' },
    { course: 'c7', col1: 'VARSITY.1', col2: 'VARSITY.2', col3: 'VARSITY.3' },
    { course: 'c8', col1: 'SHORT ADVANCED.1', col2: 'SHORT ADVANCED.2', col3: 'SHORT ADVANCED.3' },
    { course: 'c9', col1: 'COLLEGE VARSITYLONG ADVANCED.1', col2: 'COLLEGE VARSITYLONG ADVANCED.2', col3: 'COLLEGE VARSITYLONG ADVANCED.3' },
] as const

export async function insertStartListCsv(data:PdfStartListRecord[]) {
    const participants:ParticipantDocType[] = []
    const slots:SlotDocType[] = []

    for (const wave of data) {
        const waveTime = formatStartTime(wave.Time)

        for (const { course, col1, col2, col3 } of COURSE_COLUMNS) {
            const p = participantFromStartListData(
                participantIdFor(course, waveTime),
                wave[col1],
                wave[col2],
                wave[col3]
            )
            if (p !== undefined) {
                participants.push({ ...p, originalStartTime: waveTime, startChanged: false })
            }
            slots.push({
                id: slotIdFor(course, waveTime),
                time: waveTime,
                course: course,
                participants: p !== undefined ? [p.id] : [],
                isUsable: true
            })
        }
    }

    // add magic slots
    for (const { course } of COURSE_COLUMNS) {
        for (const specialTime of ['_notAttending', '_needsAssignment']) {
            slots.push({
                id: slotIdFor(course, specialTime),
                time: specialTime,
                course: course,
                participants: [],
                isUsable: true
            })
        }
    }

    const newParticipants = participants.filter((p) => !participantsTanCollection.has(p.id))
    if (newParticipants.length > 0) {
        await bulkUpsertParticipants(newParticipants)
    }

    const newSlots = slots.filter((s) => !slotsTanCollection.has(s.id))
    if (newSlots.length > 0) {
        await bulkUpsertSlots(newSlots)
    }

    console.log(`Start list loaded for event ${EVENT_ID} (${newParticipants.length} participants, ${newSlots.length} slots)`)
}