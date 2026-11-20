import { beforeEach, describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Papa, { type ParseResult } from 'papaparse'
import {
    changesSchemaLiteral,
    participantSchemaLiteral,
    slotSchemaLiteral,
} from './Schema'
import {
    changesTanCollection,
    cleanupLegacyDuplicateRecords,
    dropAllChanges,
    dropAllParticipants,
    dropAllSlots,
    participantsTanCollection,
    slotsTanCollection,
} from './database'
import {
    formatStartTime,
    getCourseForClass,
    insertStartListCsv,
    participantFromStartListData,
    participantIdFor,
    slotIdFor,
    type PdfStartListRecord,
} from './dataImport'
import {
    addCustomStartTime,
    addNewParticipant,
    assignStandbyToNoShowSlot,
    clearStateNoShow,
    clearStateWrongEpunch,
    setAllChangesProcessed,
    setChangeProcessed,
    setCompetitive,
    setGroupSize,
    setHasRentedCompass,
    setNewEpunch,
    setNewStartTime,
    setNonCompetitive,
    setStateNeedsAssignment,
    setStateNoShow,
    setStateNotAttending,
    setStatePresent,
    setStateValidated,
    setStateWaiting,
    setStateWrongEpunch,
} from './actions/participantActions'
import { keepOnlyInSlot, putInNeedsAssignment } from './actions/repairActions'
import { getOriginalEpunch, getOriginalStart } from './utils/originalValues'
import { filterDownloadChanges } from './utils/downloadChanges'
import { addMinutesToClock, calculateCourseHeadcount, changeTypeLabel, evaluateStartTimesForSchool, findStandbyMatches, formatSlotTime, normalizeCustomStartTime } from './utils/slotLabels'
import { hasNoShow, hasWrongEpunch } from './utils/styleHelpers'

function makeWaveRow(
    time: string,
    entries: Partial<Record<keyof Omit<PdfStartListRecord, 'Time'>, string>>
): PdfStartListRecord {
    return {
        Time: time,
        'ELEMENTARYBEGINNER.1': entries['ELEMENTARYBEGINNER.1'] ?? '',
        'ELEMENTARYBEGINNER.2': entries['ELEMENTARYBEGINNER.2'] ?? '',
        'ELEMENTARYBEGINNER.3': entries['ELEMENTARYBEGINNER.3'] ?? '',
        'MIDDLE SCHOOL.1': entries['MIDDLE SCHOOL.1'] ?? '',
        'MIDDLE SCHOOL.2': entries['MIDDLE SCHOOL.2'] ?? '',
        'MIDDLE SCHOOL.3': entries['MIDDLE SCHOOL.3'] ?? '',
        'ROOKIE FEMALEADV BEGINNER.1': entries['ROOKIE FEMALEADV BEGINNER.1'] ?? '',
        'ROOKIE FEMALEADV BEGINNER.2': entries['ROOKIE FEMALEADV BEGINNER.2'] ?? '',
        'ROOKIE FEMALEADV BEGINNER.3': entries['ROOKIE FEMALEADV BEGINNER.3'] ?? '',
        'ROOKIE MALE.1': entries['ROOKIE MALE.1'] ?? '',
        'ROOKIE MALE.2': entries['ROOKIE MALE.2'] ?? '',
        'ROOKIE MALE.3': entries['ROOKIE MALE.3'] ?? '',
        'JV FEMALECOLLEGIATE JVINTERMEDIATE.1': entries['JV FEMALECOLLEGIATE JVINTERMEDIATE.1'] ?? '',
        'JV FEMALECOLLEGIATE JVINTERMEDIATE.2': entries['JV FEMALECOLLEGIATE JVINTERMEDIATE.2'] ?? '',
        'JV FEMALECOLLEGIATE JVINTERMEDIATE.3': entries['JV FEMALECOLLEGIATE JVINTERMEDIATE.3'] ?? '',
        'JV MALE.1': entries['JV MALE.1'] ?? '',
        'JV MALE.2': entries['JV MALE.2'] ?? '',
        'JV MALE.3': entries['JV MALE.3'] ?? '',
        'VARSITY.1': entries['VARSITY.1'] ?? '',
        'VARSITY.2': entries['VARSITY.2'] ?? '',
        'VARSITY.3': entries['VARSITY.3'] ?? '',
        'SHORT ADVANCED.1': entries['SHORT ADVANCED.1'] ?? '',
        'SHORT ADVANCED.2': entries['SHORT ADVANCED.2'] ?? '',
        'SHORT ADVANCED.3': entries['SHORT ADVANCED.3'] ?? '',
        'COLLEGE VARSITYLONG ADVANCED.1': entries['COLLEGE VARSITYLONG ADVANCED.2'] ? (entries['COLLEGE VARSITYLONG ADVANCED.1'] ?? '') : (entries['COLLEGE VARSITYLONG ADVANCED.1'] ?? ''),
        'COLLEGE VARSITYLONG ADVANCED.2': entries['COLLEGE VARSITYLONG ADVANCED.2'] ?? '',
        'COLLEGE VARSITYLONG ADVANCED.3': entries['COLLEGE VARSITYLONG ADVANCED.3'] ?? '',
    }
}

/**
 * Asserts the fundamental Waves data integrity invariant:
 * Every participant in the database must appear in the `participants` array
 * of EXACTLY ONE slot across the entire database.
 */
function assertEveryParticipantInExactlyOneSlot() {
    const participants = [...participantsTanCollection.values()]
    const slots = [...slotsTanCollection.values()]

    const countByParticipant = new Map<string, number>()
    for (const p of participants) {
        countByParticipant.set(p.id, 0)
    }

    for (const slot of slots) {
        for (const pid of slot.participants) {
            expect(participantsTanCollection.has(pid)).toBe(true)
            countByParticipant.set(pid, (countByParticipant.get(pid) ?? 0) + 1)
        }
    }

    for (const [pid, count] of countByParticipant.entries()) {
        expect(count, `Participant ${pid} should be in exactly 1 slot, found in ${count}`).toBe(1)
    }
}

describe('Waves Meet Data Integrity & Workflow Suite', () => {
    beforeEach(async () => {
        await dropAllSlots()
        await dropAllParticipants()
        await dropAllChanges()
    })

    describe('1. CSV Importer & Start-Time Formatting', () => {
        it('zero-pads single-digit hours and strips trailing :00 seconds', () => {
            expect(formatStartTime('8:30:00')).toBe('08:30')
            expect(formatStartTime('9:04')).toBe('09:04')
            expect(formatStartTime('10:02:00')).toBe('10:02')
            expect(formatStartTime('13:45')).toBe('13:45')
        })

        it('maps WIOL & public classes to courses c1..c9', () => {
            expect(getCourseForClass('W1F')).toBe('c1')
            expect(getCourseForClass('W2M')).toBe('c2')
            expect(getCourseForClass('W4M')).toBe('c4')
            expect(getCourseForClass('W7F')).toBe('c7')
            expect(getCourseForClass('9O')).toBe('c9')
        })

        it('parses individual runners, multi-digit groups, rentals, non-compete, N (waiver), and Need $ flags', () => {
            const normal = participantFromStartListData('p1', 'Alice Runner', 'Lakeside', '8654321')
            expect(normal).toEqual({
                id: 'p1',
                name: 'Alice Runner',
                club: 'Lakeside',
                epunch: '8654321',
                isRental: false,
                isNonCompete: false,
                needsWaiver: false,
                needsPayment: false,
                state: 'waiting',
                groupSize: 1,
            })

            const largeGroup = participantFromStartListData('p2', 'Troop 42', 'Group (14)', '2091111 R NC')
            expect(largeGroup).toEqual({
                id: 'p2',
                name: 'Troop 42',
                club: 'unknown',
                epunch: '2091111',
                isRental: true,
                isNonCompete: true,
                needsWaiver: false,
                needsPayment: false,
                state: 'waiting',
                groupSize: 14,
            })

            const shiftedCol = participantFromStartListData('p3', 'Solo Orienteer', '998877 R', '')
            expect(shiftedCol).toEqual({
                id: 'p3',
                name: 'Solo Orienteer',
                club: 'unknown',
                epunch: '998877',
                isRental: true,
                isNonCompete: false,
                needsWaiver: false,
                needsPayment: false,
                state: 'waiting',
                groupSize: 1,
            })

            const missingWaiver = participantFromStartListData('p4', 'Dorothy Vaughan', 'Northgate', '2423692 - NC - N')
            expect(missingWaiver).toEqual({
                id: 'p4',
                name: 'Dorothy Vaughan',
                club: 'Northgate',
                epunch: '2423692',
                isRental: false,
                isNonCompete: true,
                needsWaiver: true,
                needsPayment: false,
                state: 'waiting',
                groupSize: 1,
            })

            const needsMoney = participantFromStartListData('p5', 'Charles Babbage', 'Lakeside', '2221885- Need $')
            expect(needsMoney).toEqual({
                id: 'p5',
                name: 'Charles Babbage',
                club: 'Lakeside',
                epunch: '2221885',
                isRental: false,
                isNonCompete: false,
                needsWaiver: false,
                needsPayment: true,
                state: 'waiting',
                groupSize: 1,
            })

            const inlineGroup = participantFromStartListData('p6', 'Radia Perlman Group (2)', '7002107', '')
            expect(inlineGroup).toEqual({
                id: 'p6',
                name: 'Radia Perlman',
                club: 'unknown',
                epunch: '7002107',
                isRental: false,
                isNonCompete: false,
                needsWaiver: false,
                needsPayment: false,
                state: 'waiting',
                groupSize: 2,
            })
        })

        it('imports startlist rows idempotently without creating duplicates on repeated import', async () => {
            const rows: PdfStartListRecord[] = [
                makeWaveRow('9:58:00', {
                    'ELEMENTARYBEGINNER.1': 'Ada Lovelace',
                    'ELEMENTARYBEGINNER.2': 'Ingraham',
                    'ELEMENTARYBEGINNER.3': '100001',
                    'VARSITY.1': 'Alan Turing',
                    'VARSITY.2': 'Garfield',
                    'VARSITY.3': '100002 R',
                }),
                makeWaveRow('10:00:00', {
                    'ELEMENTARYBEGINNER.1': 'Grace Hopper',
                    'ELEMENTARYBEGINNER.2': 'Group (11)',
                    'ELEMENTARYBEGINNER.3': '100003 NC',
                }),
            ]

            await insertStartListCsv(rows)
            expect([...participantsTanCollection.values()]).toHaveLength(3)
            assertEveryParticipantInExactlyOneSlot()

            // Simulate a second laptop importing the same CSV simultaneously:
            await insertStartListCsv(rows)
            expect([...participantsTanCollection.values()]).toHaveLength(3)
            assertEveryParticipantInExactlyOneSlot()

            const ada = participantsTanCollection.get(participantIdFor('c1', '09:58'))
            expect(ada?.name).toBe('Ada Lovelace')
            expect(ada?.originalStartTime).toBe('09:58')

            const grace = participantsTanCollection.get(participantIdFor('c1', '10:00'))
            expect(grace?.groupSize).toBe(11)
            expect(grace?.isNonCompete).toBe(true)
        })

        it('parses UTF-8 BOM CSV text with accented names, flags, and inline groups (and validates any local startlist.csv)', async () => {
            const sampleCsv =
                '\uFEFF' +
                [
                    'Time,ELEMENTARYBEGINNER.1,ELEMENTARYBEGINNER.2,ELEMENTARYBEGINNER.3,MIDDLE SCHOOL.1,MIDDLE SCHOOL.2,MIDDLE SCHOOL.3,ROOKIE FEMALEADV BEGINNER.1,ROOKIE FEMALEADV BEGINNER.2,ROOKIE FEMALEADV BEGINNER.3,ROOKIE MALE.1,ROOKIE MALE.2,ROOKIE MALE.3,JV FEMALECOLLEGIATE JVINTERMEDIATE.1,JV FEMALECOLLEGIATE JVINTERMEDIATE.2,JV FEMALECOLLEGIATE JVINTERMEDIATE.3,JV MALE.1,JV MALE.2,JV MALE.3,VARSITY.1,VARSITY.2,VARSITY.3,SHORT ADVANCED.1,SHORT ADVANCED.2,SHORT ADVANCED.3,COLLEGE VARSITYLONG ADVANCED.1,COLLEGE VARSITYLONG ADVANCED.2,COLLEGE VARSITYLONG ADVANCED.3',
                    '10:00:00,Mateo Núñez,Northgate,2423692 - NC - N,Charles Babbage,Lakeside,2221885- Need $,Radia Perlman Group (2),7002107,,,,,,,,,,,,,,,,,,,,,',
                ].join('\n')

            const syntheticParsed: ParseResult<PdfStartListRecord> = Papa.parse(sampleCsv, {
                header: true,
                skipEmptyLines: true,
                delimiter: ',',
            })
            await insertStartListCsv(syntheticParsed.data)

            const synthParticipants = [...participantsTanCollection.values()]
            expect(synthParticipants).toHaveLength(3)
            assertEveryParticipantInExactlyOneSlot()
            expect(synthParticipants.find((p) => p.name === 'Mateo Núñez')?.needsWaiver).toBe(true)
            expect(synthParticipants.find((p) => p.name === 'Charles Babbage')?.needsPayment).toBe(true)
            expect(synthParticipants.find((p) => p.name === 'Radia Perlman')?.groupSize).toBe(2)

            // If a local gitignored startlist.csv is present on disk, verify it imports cleanly too.
            const csvPath = resolve(__dirname, '../public/startlist.csv')
            if (existsSync(csvPath)) {
                await dropAllParticipants()
                await dropAllSlots()
                const csvText = readFileSync(csvPath, 'utf-8')
                const parsed: ParseResult<PdfStartListRecord> = Papa.parse(csvText, {
                    header: true,
                    skipEmptyLines: true,
                    delimiter: ',',
                })
                await insertStartListCsv(parsed.data)
                const allP = [...participantsTanCollection.values()]
                expect(allP.length).toBeGreaterThan(0)
                expect(allP.every((p) => p.name.trim().length > 0)).toBe(true)
                assertEveryParticipantInExactlyOneSlot()
            }
        })
    })

    describe('2. Station State Transitions & "Exactly One Slot" Invariant', () => {
        const pAda = participantIdFor('c1', '10:00')
        const pAlan = participantIdFor('c7', '10:00')
        const slotC1_1000 = slotIdFor('c1', '10:00')
        const slotC1_1002 = slotIdFor('c1', '10:02')
        const slotC2_1002 = slotIdFor('c2', '10:02')

        beforeEach(async () => {
            await insertStartListCsv([
                makeWaveRow('10:00:00', {
                    'ELEMENTARYBEGINNER.1': 'Ada Lovelace',
                    'ELEMENTARYBEGINNER.2': 'Ingraham',
                    'ELEMENTARYBEGINNER.3': '100001',
                    'VARSITY.1': 'Alan Turing',
                    'VARSITY.2': 'Garfield',
                    'VARSITY.3': '100002',
                }),
                makeWaveRow('10:02:00', {}),
            ])
        })

        it('preserves the 1-slot invariant across Call-up, E-punch Check, and Start Manager states', async () => {
            // 1. Call-up marks Ada present and Alan no-show
            await setStatePresent(pAda)
            expect(participantsTanCollection.get(pAda)?.state).toBe('present')
            assertEveryParticipantInExactlyOneSlot()

            await setStateNoShow(pAlan)
            expect(participantsTanCollection.get(pAlan)?.state).toBe('noShow')
            assertEveryParticipantInExactlyOneSlot()

            // 2. E-punch Check marks Ada validated
            await setStateValidated(pAda)
            expect(participantsTanCollection.get(pAda)?.state).toBe('validated')
            expect(participantsTanCollection.get(pAda)?.prevState).toBe('present')
            assertEveryParticipantInExactlyOneSlot()

            // 3. Alan arrives late -> moved to Needs Assignment queue
            await setStateNeedsAssignment(pAlan)
            const alanAfterQueue = participantsTanCollection.get(pAlan)!
            expect(alanAfterQueue.state).toBe('needsAssignment')
            expect(alanAfterQueue.startChanged).toBe(true)
            expect(alanAfterQueue.originalStartTime).toBe('10:00')
            expect(slotsTanCollection.get(slotIdFor('c7', '10:00'))?.participants).toEqual([])
            expect(slotsTanCollection.get(slotIdFor('c7', '_needsAssignment'))?.participants).toEqual([pAlan])
            assertEveryParticipantInExactlyOneSlot()

            // 4. Ada decides not to attend -> frees her 10:00 slot and preserves originalStartTime
            await setStateNotAttending(pAda)
            const adaAfterDns = participantsTanCollection.get(pAda)!
            expect(adaAfterDns.state).toBe('notAttending')
            expect(adaAfterDns.originalStartTime).toBe('10:00')
            expect(slotsTanCollection.get(slotC1_1000)?.participants).toEqual([])
            expect(slotsTanCollection.get(slotIdFor('c1', '_notAttending'))?.participants).toEqual([pAda])
            assertEveryParticipantInExactlyOneSlot()

            // 5. Ada comes back and is assigned to 10:02 on c1
            await setNewStartTime(pAda, slotIdFor('c1', '_notAttending'), slotC1_1002)
            expect(participantsTanCollection.get(pAda)?.state).toBe('waiting')
            expect(slotsTanCollection.get(slotC1_1002)?.participants).toEqual([pAda])
            assertEveryParticipantInExactlyOneSlot()
        })

        it('handles the Wrong E-punch workflow and auto-resolves to Validated when e-punch is edited', async () => {
            await setStatePresent(pAda)
            await setStateWrongEpunch(pAda)

            const flagged = participantsTanCollection.get(pAda)!
            expect(flagged.state).toBe('wrongEpunch')
            expect(flagged.prevState).toBe('present')
            // Remains in her 10:00 start slot
            expect(slotsTanCollection.get(slotC1_1000)?.participants).toEqual([pAda])
            assertEveryParticipantInExactlyOneSlot()

            // Start Manager updates her e-punch to a rental stick
            await setNewEpunch(pAda, '999888', true)
            const resolved = participantsTanCollection.get(pAda)!
            expect(resolved.epunch).toBe('999888')
            expect(resolved.isRental).toBe(true)
            expect(resolved.state).toBe('validated')
            expect(resolved.prevState).toBe('wrongEpunch')
            assertEveryParticipantInExactlyOneSlot()

            // Verify timing-desk change record was logged with needsProcessing = true
            const epunchChanges = [...changesTanCollection.values()].filter(
                (c) => c.participantId === pAda && c.changeType === 'epunch'
            )
            expect(epunchChanges).toHaveLength(1)
            expect(epunchChanges[0]?.needsProcessing).toBe(true)
            expect(epunchChanges[0]?.old).toBe('100001, Rental:false')
            expect(epunchChanges[0]?.new).toBe('999888, Rental:true')
        })

        it('allows a participant to be in BOTH wrongEpunch and noShow simultaneously and resolve each independently', async () => {
            // Mark Alan as No Show first, then Wrong E-punch -> holds both flags simultaneously
            await setStateNoShow(pAlan)
            await setStateWrongEpunch(pAlan)
            const alanBoth = participantsTanCollection.get(pAlan)!
            expect(hasNoShow(alanBoth)).toBe(true)
            expect(hasWrongEpunch(alanBoth)).toBe(true)

            // Clearing No Show preserves Wrong E-punch
            await clearStateNoShow(pAlan)
            const alanOnlyWrongEpunch = participantsTanCollection.get(pAlan)!
            expect(hasNoShow(alanOnlyWrongEpunch)).toBe(false)
            expect(hasWrongEpunch(alanOnlyWrongEpunch)).toBe(true)

            // Mark No Show again while Wrong E-punch is active -> holds both flags again
            await setStateNoShow(pAlan)
            const alanBothAgain = participantsTanCollection.get(pAlan)!
            expect(hasNoShow(alanBothAgain)).toBe(true)
            expect(hasWrongEpunch(alanBothAgain)).toBe(true)

            // Clearing Wrong E-punch preserves No Show
            await clearStateWrongEpunch(pAlan)
            const alanOnlyNoShow = participantsTanCollection.get(pAlan)!
            expect(hasNoShow(alanOnlyNoShow)).toBe(true)
            expect(hasWrongEpunch(alanOnlyNoShow)).toBe(false)
            assertEveryParticipantInExactlyOneSlot()
        })

        it('tracks original start slot and original e-punch across multiple moves and edits', async () => {
            // Move Ada from c1 10:00 -> c1 10:02 -> c2 10:02
            await setNewStartTime(pAda, slotC1_1000, slotC1_1002)
            await setNewStartTime(pAda, slotC1_1002, slotC2_1002)
            assertEveryParticipantInExactlyOneSlot()

            // Edit Ada's e-punch twice
            await setNewEpunch(pAda, '222222', true)
            await setNewEpunch(pAda, '333333', false)

            // Toggle competitive status
            await setNonCompetitive(pAda)
            expect(participantsTanCollection.get(pAda)?.isNonCompete).toBe(true)
            await setCompetitive(pAda)
            expect(participantsTanCollection.get(pAda)?.isNonCompete).toBe(false)

            const allChanges = [...changesTanCollection.values()]
            const adaDoc = participantsTanCollection.get(pAda)!

            // Original start must still be c1 10:00
            const origStart = getOriginalStart(pAda, adaDoc.originalStartTime, 'c2', allChanges)
            expect(origStart).toEqual({ course: 'c1', time: '10:00' })

            // Original e-punch must still be 100001 (non-rental)
            const origEpunch = getOriginalEpunch(pAda, allChanges)
            expect(origEpunch).toEqual({ epunch: '100001', isRental: false })

            // Course change must require timing desk processing, while same-course time change does not
            const timeChange = allChanges.find((c) => c.participantId === pAda && c.changeType === 'newTime')
            const courseChange = allChanges.find((c) => c.participantId === pAda && c.changeType === 'newCourse')
            expect(timeChange?.needsProcessing).toBe(false)
            expect(courseChange?.needsProcessing).toBe(true)
        })

        it('repairs broken records (0 slots or 2+ slots) and restores the 1-slot invariant', async () => {
            // Simulate a multi-device conflict that listed Ada in two slots simultaneously
            const txDup = slotsTanCollection.update(slotC1_1002, (s) => {
                s.participants = [pAda]
            })
            await txDup.isPersisted.promise

            const allSlots = [...slotsTanCollection.values()]
            const keepTarget = slotsTanCollection.get(slotC1_1002)!
            await keepOnlyInSlot(pAda, keepTarget, allSlots)
            assertEveryParticipantInExactlyOneSlot()
            expect(slotsTanCollection.get(slotC1_1000)?.participants).toEqual([])
            expect(slotsTanCollection.get(slotC1_1002)?.participants).toEqual([pAda])

            // Simulate an orphaned record where Alan is in 0 slots
            const txOrphan = slotsTanCollection.update(slotIdFor('c7', '10:00'), (s) => {
                s.participants = []
            })
            await txOrphan.isPersisted.promise

            const magicC7 = slotsTanCollection.get(slotIdFor('c7', '_needsAssignment'))!
            await putInNeedsAssignment(pAlan, magicC7)
            assertEveryParticipantInExactlyOneSlot()
            expect(participantsTanCollection.get(pAlan)?.state).toBe('needsAssignment')
            expect(slotsTanCollection.get(slotIdFor('c7', '_needsAssignment'))?.participants).toEqual([pAlan])

            // Resetting to waiting works once back in a real slot
            await setNewStartTime(pAlan, slotIdFor('c7', '_needsAssignment'), slotIdFor('c7', '10:00'))
            await setStateWaiting(pAlan)
            expect(participantsTanCollection.get(pAlan)?.state).toBe('waiting')
            assertEveryParticipantInExactlyOneSlot()
        })

        it('adds a new participant or 2nd-course school racer while preserving the 1-slot invariant', async () => {
            const newId = await addNewParticipant({
                name: 'Ada Lovelace',
                course: 'c2',
                club: 'Ingraham',
                epunch: '100001',
                isRental: false,
                isNonCompete: true,
                groupSize: 1,
                targetSlotId: slotC2_1002,
            })
            expect(newId).toBeDefined()
            assertEveryParticipantInExactlyOneSlot()

            const created = participantsTanCollection.get(newId!)!
            expect(created.name).toBe('Ada Lovelace')
            expect(created.club).toBe('Ingraham')
            expect(created.epunch).toBe('100001')
            expect(created.isNonCompete).toBe(true)
            expect(created.state).toBe('waiting')
            expect(created.originalStartTime).toBe('10:02')
            expect(slotsTanCollection.get(slotC2_1002)?.participants).toContain(newId)

            const addedChange = [...changesTanCollection.values()].find(
                (c) => c.participantId === newId && c.changeType === 'addedParticipant'
            )
            expect(addedChange).toBeDefined()
            expect(addedChange?.new).toBe('c2 10:02')
        })

        it('detects standby matches when a same-course no-show occurs and slots standby runner as Present while keeping the no-show in No-shows', async () => {
            // Add a runner on c7 in Standby
            const standbyId = await addNewParticipant({
                name: 'Edsger Dijkstra',
                course: 'c7',
                club: 'Garfield',
                epunch: '777888',
                isRental: true,
                isNonCompete: false,
                groupSize: 1,
            })
            expect(standbyId).toBeDefined()
            expect(participantsTanCollection.get(standbyId!)?.state).toBe('needsAssignment')

            // Before Alan Turing (c7 10:00) is marked No Show, no standby matches exist
            expect(
                findStandbyMatches(
                    [...participantsTanCollection.values()],
                    [...slotsTanCollection.values()],
                    [...changesTanCollection.values()]
                )
            ).toHaveLength(0)

            // Mark Alan Turing (c7 10:00) as No Show -> triggers a Standby Match on c7 at 10:00!
            await setStateNoShow(pAlan)
            const matches = findStandbyMatches(
                [...participantsTanCollection.values()],
                [...slotsTanCollection.values()],
                [...changesTanCollection.values()]
            )
            expect(matches).toHaveLength(1)
            expect(matches[0]?.course).toBe('c7')
            expect(matches[0]?.slot.time).toBe('10:00')
            expect(matches[0]?.noShowParticipant.id).toBe(pAlan)
            expect(matches[0]?.standbyParticipants.map((p) => p.id)).toEqual([standbyId!])

            // Start Manager approves slotting Edsger Dijkstra into Alan Turing's 10:00 slot
            const slotted = await assignStandbyToNoShowSlot(standbyId!, pAlan, slotIdFor('c7', '10:00'))
            expect(slotted).toBe(true)
            assertEveryParticipantInExactlyOneSlot()

            // Edsger Dijkstra is now in c7 10:00 directly as Present (ready for E-punch Check)
            expect(slotsTanCollection.get(slotIdFor('c7', '10:00'))?.participants).toEqual([standbyId!])
            expect(participantsTanCollection.get(standbyId!)?.state).toBe('present')

            // Alan Turing stays in No-shows (hasNoShow === true) and preserves originalStartTime = 10:00
            const alanAfter = participantsTanCollection.get(pAlan)!
            expect(hasNoShow(alanAfter)).toBe(true)
            expect(alanAfter.originalStartTime).toBe('10:00')

            // The c7 10:00 slot is now filled, so no standby match notification remains
            expect(
                findStandbyMatches(
                    [...participantsTanCollection.values()],
                    [...slotsTanCollection.values()],
                    [...changesTanCollection.values()]
                )
            ).toHaveLength(0)
        })
        it('updates group size (individual <-> group) and computes total people on course (+1 shadow for original NC, 0 shadows for 2nd-course NC, subtracting no-shows/not-attending)', async () => {
            const pAda = participantIdFor('c1', '10:00')
            const pAlan = participantIdFor('c7', '10:00')

            await setGroupSize(pAda, 3)
            expect(participantsTanCollection.get(pAda)?.groupSize).toBe(3)
            await setGroupSize(pAda, 4)
            expect(participantsTanCollection.get(pAda)?.groupSize).toBe(4)

            // Mark Ada (original start list entry) as Non-Competitive -> counts +1 shadow
            await setNonCompetitive(pAda)

            // Add a 2nd-course entry (marked NC + isSecondCourse: true) -> CANNOT have a shadow (0 shadows)
            const secondCourseId = await addNewParticipant({
                name: 'Ada Lovelace',
                course: 'c2',
                club: 'Lakeside',
                epunch: '888999',
                isRental: true,
                isNonCompete: true,
                groupSize: 1,
                targetSlotId: slotIdFor('c2', '10:02'),
                isSecondCourse: true,
            })
            expect(secondCourseId).toBeDefined()

            await setStateNoShow(pAlan)

            const summary = calculateCourseHeadcount(
                [...participantsTanCollection.values()],
                [...slotsTanCollection.values()]
            )
            expect(summary.totalRegisteredEntries).toBe(3)
            expect(summary.subtractedNoShowEntries).toBe(1)
            expect(summary.subtractedNotAttendingEntries).toBe(0)
            expect(summary.activeEntriesOnCourse).toBe(2)
            expect(summary.runnersFromIndividualsAndGroups).toBe(5)
            expect(summary.nonCompetitiveShadows).toBe(1)
            expect(summary.totalPeopleOnCourse).toBe(6)
        })
    })

    describe('3. Clock, Wave Offset, and Label Helpers', () => {
        it('computes wave cutoff times accurately across hour and midnight boundaries', () => {
            expect(addMinutesToClock('09:56:15', 8)).toBe('10:04')
            expect(addMinutesToClock('10:00:00', 0)).toBe('10:00')
            expect(addMinutesToClock('23:55:00', 10)).toBe('00:05')
            expect(addMinutesToClock('', 8)).toBe('')
        })

        it('formats magic slot names and change types for volunteers', () => {
            expect(formatSlotTime('_needsAssignment')).toBe('Standby')
            expect(formatSlotTime('_notAttending')).toBe('Not attending')
            expect(formatSlotTime('10:04')).toBe('10:04')
            expect(changeTypeLabel('wrongEpunch')).toBe('Wrong e-punch')
            expect(changeTypeLabel('newCourse')).toBe('New course')
        })

        it('recommends 6-minute spacing between teammates from the same school on the same course', () => {
            const allParticipants = [
                { id: 'p-teammate', name: 'Ada Lovelace', club: 'Ingraham High' },
                { id: 'p-late', name: 'Bob Smith', club: 'Ingraham High' },
                { id: 'p-other-school', name: 'Alan Turing', club: 'Garfield High' },
            ]
            const allSlots = [
                { id: 's-1000', course: 'c1', time: '10:00', participants: ['p-teammate'], isUsable: true },
                { id: 's-1002', course: 'c1', time: '10:02', participants: ['p-other-school'], isUsable: true },
                { id: 's-1004', course: 'c1', time: '10:04', participants: [], isUsable: true },
                { id: 's-1006', course: 'c1', time: '10:06', participants: [], isUsable: true },
                { id: 's-1008', course: 'c1', time: '10:08', participants: [], isUsable: true },
            ]
            const openSlots = allSlots.filter((s) => s.participants.length === 0)

            const rec = evaluateStartTimesForSchool({
                openSlots,
                allSlots,
                allParticipants,
                course: 'c1',
                participantClub: 'Ingraham High',
                excludeParticipantId: 'p-late',
            })

            // 10:04 is within < 6 minutes of Ada at 10:00; 10:06 is >= 6 minutes apart
            expect(rec.recommendedSlot?.slot.time).toBe('10:06')
            expect(rec.recommendedSlot?.isPreferred).toBe(true)
            expect(rec.skippedEarlierSlots.map((s) => s.slot.time)).toEqual(['10:04'])
            expect(rec.reason).toContain('Ada Lovelace at 10:00')
            expect(rec.reason).toContain('6 minutes')

            // Fallback when only <6-min slots exist: picks the slot with the largest gap (10:04, 4 min apart)
            const onlyCloseSlots = openSlots.filter((s) => s.time < '10:06')
            const fallbackRec = evaluateStartTimesForSchool({
                openSlots: onlyCloseSlots,
                allSlots,
                allParticipants,
                course: 'c1',
                participantClub: 'Ingraham High',
                excludeParticipantId: 'p-late',
            })
            expect(fallbackRec.recommendedSlot?.slot.time).toBe('10:04')
            expect(fallbackRec.recommendedSlot?.isPreferred).toBe(false)
            expect(fallbackRec.reason).toContain('No open times on c1 have a full 6-minute gap')
        })

        it('prioritizes FIFO standby runners without a <6 min same-school conflict while keeping slot available for all standby runners', async () => {
            await insertStartListCsv([
                makeWaveRow('10:00:00', {
                    'VARSITY.1': 'NoShow Starter',
                    'VARSITY.2': 'Lakeside',
                    'VARSITY.3': '111111',
                }),
                makeWaveRow('10:02:00', {
                    'VARSITY.1': 'Active Ingraham Teammate',
                    'VARSITY.2': 'Ingraham High',
                    'VARSITY.3': '222222',
                }),
            ])

            // 1st standby runner (entered first): from Ingraham High (has teammate at 10:02, within 2 min of 10:00)
            const firstStandbyId = await addNewParticipant({
                name: 'First Standby (Ingraham)',
                course: 'c7',
                club: 'Ingraham High',
                epunch: '333333',
                isRental: true,
                isNonCompete: true,
                groupSize: 1,
                isSecondCourse: true,
            })

            // 2nd standby runner (entered second): from Garfield High (no conflict at 10:00)
            const secondStandbyId = await addNewParticipant({
                name: 'Second Standby (Garfield)',
                course: 'c7',
                club: 'Garfield High',
                epunch: '444444',
                isRental: true,
                isNonCompete: false,
                groupSize: 1,
            })

            expect(participantsTanCollection.get(firstStandbyId!)?.isSecondCourse).toBe(true)

            // Mark 10:00 starter as No Show
            const noShowId = participantIdFor('c7', '10:00')
            await setStateNoShow(noShowId)

            const matches = findStandbyMatches(
                [...participantsTanCollection.values()],
                [...slotsTanCollection.values()],
                [...changesTanCollection.values()]
            )
            expect(matches).toHaveLength(1)
            const match = matches[0]!

            // Priority goes to Second Standby (Garfield) because First Standby (Ingraham) has a teammate at 10:02 (<6 min)
            expect(match.priorityStandbyParticipant.id).toBe(secondStandbyId)
            // Both runners are still in standbyParticipants so either can be assigned from their runner page
            expect(match.standbyParticipants.map((p) => p.id)).toEqual([secondStandbyId!, firstStandbyId!])
            expect(match.conflictsByStandbyId[firstStandbyId!]?.teammateName).toBe('Active Ingraham Teammate')
            expect(match.conflictsByStandbyId[secondStandbyId!]).toBeUndefined()
        })

        it('removes legacy unprefixed p-* and s-* duplicate records when prefixed event records exist', async () => {
            await insertStartListCsv([
                makeWaveRow('10:00:00', {
                    'ELEMENTARYBEGINNER.1': 'Ada Lovelace',
                    'ELEMENTARYBEGINNER.2': 'Ingraham High',
                    'ELEMENTARYBEGINNER.3': '100001',
                }),
            ])
            const tx1 = participantsTanCollection.insert([
                {
                    id: 'p-c1-10:00',
                    name: 'Ada Lovelace',
                    club: 'Ingraham High',
                    epunch: '100001',
                    isRental: false,
                    isNonCompete: false,
                    state: 'waiting',
                    groupSize: 1,
                    originalStartTime: '10:00',
                    startChanged: false,
                },
            ])
            await tx1.isPersisted.promise
            const tx2 = slotsTanCollection.insert([
                {
                    id: 's-c1-10:00',
                    course: 'c1',
                    time: '10:00',
                    participants: ['p-c1-10:00'],
                    isUsable: true,
                },
            ])
            await tx2.isPersisted.promise

            expect(participantsTanCollection.has('p-c1-10:00')).toBe(true)
            expect(slotsTanCollection.has('s-c1-10:00')).toBe(true)

            await cleanupLegacyDuplicateRecords()

            expect(participantsTanCollection.has('p-c1-10:00')).toBe(false)
            expect(slotsTanCollection.has('s-c1-10:00')).toBe(false)
            expect(participantsTanCollection.has(participantIdFor('c1', '10:00'))).toBe(true)
            expect(slotsTanCollection.has(slotIdFor('c1', '10:00'))).toBe(true)
        })

        it('cancels round-trip course, epunch, and NC changes on Download while keeping unrelated changes and pending reverts after a clear', async () => {
            await insertStartListCsv([
                makeWaveRow('10:00:00', {
                    'ELEMENTARYBEGINNER.1': 'Ada Lovelace',
                    'ELEMENTARYBEGINNER.2': 'Ingraham High',
                    'ELEMENTARYBEGINNER.3': '100001',
                    'MIDDLE SCHOOL.1': '',
                }),
                makeWaveRow('10:02:00', {
                    'ELEMENTARYBEGINNER.1': '',
                    'MIDDLE SCHOOL.1': '',
                }),
            ])

            const pAda = participantIdFor('c1', '10:00')
            const slotC1_1000 = slotIdFor('c1', '10:00')
            const slotC2_1000 = slotIdFor('c2', '10:00')
            const slotC1_1002 = slotIdFor('c1', '10:02')

            // Move c1 -> c2 -> c1 (returning to a different time on c1), plus an epunch change in between
            await setNewStartTime(pAda, slotC1_1000, slotC2_1000)
            await setNewEpunch(pAda, '777777', false)
            await setNewStartTime(pAda, slotC2_1000, slotC1_1002)

            // Audit trail keeps both newCourse records, but Download only keeps the epunch change
            const rawCourseChanges = [...changesTanCollection.values()].filter(
                (c) => c.participantId === pAda && c.changeType === 'newCourse'
            )
            expect(rawCourseChanges).toHaveLength(2)

            let download = filterDownloadChanges([...changesTanCollection.values()])
            expect(download.map((c) => c.changeType)).toEqual(['epunch'])

            // Round-trip epunch back to original 100001 and toggle NC -> Competitive -> both cancel too
            await setNewEpunch(pAda, '100001', false)
            await setNonCompetitive(pAda)
            await setCompetitive(pAda)
            download = filterDownloadChanges([...changesTanCollection.values()])
            expect(download).toEqual([])

            // If Download already cleared c1 -> c2 BEFORE Start Manager moves back c2 -> c1,
            // Download must still see c2 -> c1 in Pending until it is also cleared.
            await setNewStartTime(pAda, slotC1_1002, slotC2_1000)
            const firstMove = [...changesTanCollection.values()]
                .filter((c) => c.participantId === pAda && c.changeType === 'newCourse')
                .sort((a, b) => a.changedAt - b.changedAt)
                .at(-1)!
            await setChangeProcessed(firstMove.id, true)
            await setNewStartTime(pAda, slotC2_1000, slotC1_1002)

            download = filterDownloadChanges([...changesTanCollection.values()])
            expect(download).toHaveLength(2)
            expect(download.filter((c) => !c.isProcessed)).toHaveLength(1)
            expect(download.find((c) => !c.isProcessed)?.new).toBe('c1 10:02')

            const revertMove = download.find((c) => !c.isProcessed)!
            await setChangeProcessed(revertMove.id, true)
            download = filterDownloadChanges([...changesTanCollection.values()])
            expect(download).toEqual([])
        })

        it('collapses multi-hop pending changes into one net Download row and clears all underlying hops together', async () => {
            await insertStartListCsv([
                makeWaveRow('10:00:00', {
                    'JV FEMALECOLLEGIATE JVINTERMEDIATE.1': 'Kaellee Chavez',
                    'JV FEMALECOLLEGIATE JVINTERMEDIATE.2': 'Marysville',
                    'JV FEMALECOLLEGIATE JVINTERMEDIATE.3': '2049400',
                }),
            ])

            const pKaellee = participantIdFor('c5', '10:00')
            // C5 -> C4 -> C3 -> C2 -> C7 -> C6
            await setNewStartTime(pKaellee, slotIdFor('c5', '10:00'), slotIdFor('c4', '10:00'))
            await setNewStartTime(pKaellee, slotIdFor('c4', '10:00'), slotIdFor('c3', '10:00'))
            await setNewStartTime(pKaellee, slotIdFor('c3', '10:00'), slotIdFor('c2', '10:00'))
            await setNewStartTime(pKaellee, slotIdFor('c2', '10:00'), slotIdFor('c7', '10:00'))
            await setNewStartTime(pKaellee, slotIdFor('c7', '10:00'), slotIdFor('c6', '10:00'))

            // Change Log keeps all 5 moves, while Download collapses them to one C5 -> C6 row
            const rawMoves = [...changesTanCollection.values()].filter(
                (c) => c.participantId === pKaellee && c.changeType === 'newCourse'
            )
            expect(rawMoves).toHaveLength(5)

            let download = filterDownloadChanges([...changesTanCollection.values()])
            expect(download).toHaveLength(1)
            expect(download[0]!.old).toBe('c5 10:00')
            expect(download[0]!.new).toBe('c6 10:00')
            expect(download[0]!.isProcessed).toBe(false)
            expect(download[0]!.sourceChangeIds).toHaveLength(5)

            // Clearing that single Download row marks all 5 underlying change records processed
            await setAllChangesProcessed(download[0]!.sourceChangeIds, true)
            download = filterDownloadChanges([...changesTanCollection.values()])
            expect(download).toHaveLength(1)
            expect(download[0]!.isProcessed).toBe(true)
            expect(download[0]!.old).toBe('c5 10:00')
            expect(download[0]!.new).toBe('c6 10:00')

            // Moving later C6 -> C7 -> C4 stays one net Pending row starting from C6
            await setNewStartTime(pKaellee, slotIdFor('c6', '10:00'), slotIdFor('c7', '10:00'))
            await setNewStartTime(pKaellee, slotIdFor('c7', '10:00'), slotIdFor('c4', '10:00'))
            download = filterDownloadChanges([...changesTanCollection.values()])
            expect(download).toHaveLength(2)
            const pending = download.filter((c) => !c.isProcessed)
            expect(pending).toHaveLength(1)
            expect(pending[0]!.old).toBe('c6 10:00')
            expect(pending[0]!.new).toBe('c4 10:00')
            expect(pending[0]!.sourceChangeIds).toHaveLength(2)
        })

        it('validates and creates a new custom start time (e.g. 9:38 -> 09:38) across all courses and allows assigning a runner to it', async () => {
            expect(normalizeCustomStartTime('9:38')).toBe('09:38')
            expect(normalizeCustomStartTime(' 12:04 ')).toBe('12:04')
            expect(normalizeCustomStartTime('25:00')).toBeUndefined()
            expect(normalizeCustomStartTime('10:60')).toBeUndefined()
            expect(normalizeCustomStartTime('938')).toBeUndefined()

            await insertStartListCsv([
                makeWaveRow('10:00:00', {
                    'ELEMENTARYBEGINNER.1': 'Ada Lovelace',
                    'ELEMENTARYBEGINNER.2': 'Ingraham High',
                    'ELEMENTARYBEGINNER.3': '100001',
                }),
            ])

            const bad = await addCustomStartTime('bad', 'c1')
            expect(bad.ok).toBe(false)

            const created = await addCustomStartTime('9:38', 'c1')
            expect(created.ok).toBe(true)
            if (!created.ok) throw new Error('expected ok')
            expect(created.time).toBe('09:38')
            expect(created.slot.course).toBe('c1')
            expect(slotsTanCollection.get(slotIdFor('c1', '09:38'))?.isUsable).toBe(true)
            expect(slotsTanCollection.get(slotIdFor('c7', '09:38'))?.isUsable).toBe(true)

            const pAda = participantIdFor('c1', '10:00')
            await setNewStartTime(pAda, slotIdFor('c1', '10:00'), created.slot.id)
            assertEveryParticipantInExactlyOneSlot()
            expect(slotsTanCollection.get(created.slot.id)?.participants).toEqual([pAda])

            // Attempting to add an already-occupied slot returns an error without double-booking
            const dupOccupied = await addCustomStartTime('09:38', 'c1')
            expect(dupOccupied.ok).toBe(false)
        })

        it('tracks compass rentals (Rent Compass -> Compass Needs Return -> Cleared on return)', async () => {
            await insertStartListCsv([
                makeWaveRow('10:00:00', {
                    'ELEMENTARYBEGINNER.1': 'Ada Lovelace',
                    'ELEMENTARYBEGINNER.2': 'Ingraham High',
                    'ELEMENTARYBEGINNER.3': '100001',
                }),
            ])

            const pAda = participantIdFor('c1', '10:00')
            expect(Boolean(participantsTanCollection.get(pAda)?.hasRentedCompass)).toBe(false)

            // Rent compass with ID at Start Manager / Full Grid
            await setHasRentedCompass(pAda, true, 'C-1042')
            expect(participantsTanCollection.get(pAda)?.hasRentedCompass).toBe(true)
            expect(participantsTanCollection.get(pAda)?.compassId).toBe('C-1042')

            // Clear compass when returned at Download
            await setHasRentedCompass(pAda, false)
            expect(participantsTanCollection.get(pAda)?.hasRentedCompass).toBe(false)
            expect(participantsTanCollection.get(pAda)?.compassId).toBe('')

            const compassLogs = [...changesTanCollection.values()]
                .filter((c) => c.participantId === pAda && c.changeType === 'compassRental')
                .sort((a, b) => a.changedAt - b.changedAt)
            expect(compassLogs).toHaveLength(2)
            expect(compassLogs.map((c) => c.new)).toEqual(['rented (#C-1042)', 'returned'])
        })

        it('keeps Schema.ts and waves-server/server.ts schema properties and versions in sync', () => {
            const serverSrc = readFileSync(resolve(__dirname, '../../waves-server/server.ts'), 'utf8')
            for (const propName of Object.keys(participantSchemaLiteral.properties)) {
                expect(serverSrc).toContain(`${propName}:`)
            }
            for (const propName of Object.keys(slotSchemaLiteral.properties)) {
                expect(serverSrc).toContain(`${propName}:`)
            }
            for (const propName of Object.keys(changesSchemaLiteral.properties)) {
                expect(serverSrc).toContain(`${propName}:`)
            }
            expect(serverSrc).toContain(`version: ${participantSchemaLiteral.version}`)
            expect(serverSrc).toContain(`autoMigrations(${participantSchemaLiteral.version})`)
        })
    })
})
