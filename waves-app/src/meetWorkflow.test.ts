import { beforeEach, describe, expect, it } from 'vitest'
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
    addNewParticipant,
    setCompetitive,
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
import { addMinutesToClock, changeTypeLabel, evaluateStartTimesForSchool, formatSlotTime } from './utils/slotLabels'

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

        it('parses individual runners, multi-digit groups, rentals, and non-compete flags', () => {
            const normal = participantFromStartListData('p1', 'Alice Runner', 'Lakeside', '8654321')
            expect(normal).toEqual({
                id: 'p1',
                name: 'Alice Runner',
                club: 'Lakeside',
                epunch: '8654321',
                isRental: false,
                isNonCompete: false,
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
                state: 'waiting',
                groupSize: 1,
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
    })

    describe('3. Clock, Wave Offset, and Label Helpers', () => {
        it('computes wave cutoff times accurately across hour and midnight boundaries', () => {
            expect(addMinutesToClock('09:56:15', 8)).toBe('10:04')
            expect(addMinutesToClock('10:00:00', 0)).toBe('10:00')
            expect(addMinutesToClock('23:55:00', 10)).toBe('00:05')
            expect(addMinutesToClock('', 8)).toBe('')
        })

        it('formats magic slot names and change types for volunteers', () => {
            expect(formatSlotTime('_needsAssignment')).toBe('Needs a new time')
            expect(formatSlotTime('_notAttending')).toBe('Not attending')
            expect(formatSlotTime('10:04')).toBe('10:04')
            expect(changeTypeLabel('wrongEpunch')).toBe('Wrong e-punch')
            expect(changeTypeLabel('newCourse')).toBe('New course')
        })

        it('recommends 10-minute spacing between teammates from the same school on the same course', () => {
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
                { id: 's-1010', course: 'c1', time: '10:10', participants: [], isUsable: true },
                { id: 's-1012', course: 'c1', time: '10:12', participants: [], isUsable: true },
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

            // 10:04, 10:06, 10:08 are within < 10 minutes of Ada at 10:00; 10:10 is >= 10 minutes apart
            expect(rec.recommendedSlot?.slot.time).toBe('10:10')
            expect(rec.recommendedSlot?.isPreferred).toBe(true)
            expect(rec.skippedEarlierSlots.map((s) => s.slot.time)).toEqual(['10:04', '10:06', '10:08'])
            expect(rec.reason).toContain('Ada Lovelace at 10:00')
            expect(rec.reason).toContain('10 minutes')

            // Fallback when only <10-min slots exist: picks the slot with the largest gap (10:08, 8 min apart)
            const onlyCloseSlots = openSlots.filter((s) => s.time < '10:10')
            const fallbackRec = evaluateStartTimesForSchool({
                openSlots: onlyCloseSlots,
                allSlots,
                allParticipants,
                course: 'c1',
                participantClub: 'Ingraham High',
                excludeParticipantId: 'p-late',
            })
            expect(fallbackRec.recommendedSlot?.slot.time).toBe('10:08')
            expect(fallbackRec.recommendedSlot?.isPreferred).toBe(false)
            expect(fallbackRec.reason).toContain('No open times on c1 have a full 10-minute gap')
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
    })
})
