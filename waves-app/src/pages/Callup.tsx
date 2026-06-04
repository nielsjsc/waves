import {Slot} from '@/components/Slot'
import {type Slot as SlotType} from '@/api/slots'
import {Head} from '@/components/Head'
import type { JSX } from 'react'
import { Header } from '@/components/Header'
import { useLiveQuery } from '@tanstack/react-db'
import { participantsCollection, slotsCollection } from '@/database'
import type { ParticipantDocType, SlotDocType } from '@/Schema'
import { Participant } from '@/api/participants'

function rowData(slots:SlotType[]):JSX.Element[] {
	if (slots.length < 1) {
		return ([])
	} else {
		return (slots.map((s,) =>
		<td className='px-2 py-1' key={`SlotTd-${s.time}-${s.course}`}>
			<Slot slot={s} key={`SlotCard-${s.time}-${s.course}`} />
		</td>
	))
	}
}

function populate(slots:SlotDocType[], participants:ParticipantDocType[]):SlotType[] {
	let res:SlotType[] = []
	slots.forEach(s => {
		if (s.participants === undefined) {
			res.push({
				time: s.time,
				course: s.course,
				participants: [] as Participant[],
				isUsable: true
			})
		} else {
			let filledParticipants:Participant[] = []
			s.participants.forEach(pid => {
				const p:Participant|undefined = participants.find((x) => x.id === pid) as Participant
				if (p) {
					filledParticipants.push(p)
				}
			})
			res.push({
				time: s.time,
				course: s.course,
				participants: filledParticipants,
				isUsable: true
			})
		}
	});
	return res
}

export function Callup() {

	const {data: allSlots} = useLiveQuery((q) =>
		q.from({slot: slotsCollection})
	)

	const {data: allParticipants} = useLiveQuery((q) =>
		q.from({participant: participantsCollection})
	)

	const data = populate(allSlots, allParticipants)

	const courses = data.reduce<string[]>((previous, slot) =>
		previous.some( x => x === slot.course) ? previous : [...previous, slot.course]
	, []).sort()

	const times = data.reduce<string[]>((previous, slot) =>
		previous.some( x => x === slot.time) ? previous : [...previous, slot.time]
	, []).sort()

	// Course: Time: Slot
	var gridData: SlotType[][] = []
	courses.forEach((c) => {
		var starts: SlotType[] = [];
		times.forEach((t) => {
			var s = data.find(x => x.course === c && x.time === t)
			if (s) {
				starts.push(s)
			} else {
				starts.push({course: c, time: t, participants: [], isUsable:false})
			}
		})
		gridData.push(starts)
	})
	
	// layouts: https://tailblocks.cc/
	// colors: https://tailwindcss.com/docs/colors

	return (
	<>
		<Head title='Tent 1: Call-up' />
		<Header/>
		<div className='grid'>
			<h1 className='title-font text-2xl font-medium p-2'>Tent 1: Call-up. Wave: 10:02 <span className='text-base'>next in 29s</span></h1>
			<div className='text-base p-2'>
				<a className='text-sm px-2' href="">Prev</a>
				<a className='text-sm px-2' href="">Current Wave</a>
				<a className='text-sm px-2' href="">Next</a>
			</div>
			<div className='text-base p-2'>
				Clock Time: 9:55:31. Waves are 8 minutes ahead.
			</div>
			<hr className='my-2'/>
			<div className='overflow-x-auto'>
				<table className="min-w-full table-fixed">
					<thead>
						<tr key='gridHeaderRow'>
							<th>Course</th>
							{times.map((time) => <th key={`wave-${time}`}>{time}</th>)}
						</tr>
					</thead>
					<tbody>
						{gridData.map((courseSlots,) => (
							<tr key={`CourseRow-${courseSlots[0]?.course}`}>
								<td key={`CourseTd-${courseSlots[0]?.course}`} className='font-bold text-center'>Course {courseSlots[0]?.course}</td>
								{rowData(courseSlots)}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	</>
	)
}
