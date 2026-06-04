import {type Slot as SlotType} from '@/api/slots'
import {Head} from '@/components/Head'
import { Header } from '@/components/Header'
import { useLiveQuery } from '@tanstack/react-db'
import { participantsCollection, slotsCollection } from '@/database'
import type { ParticipantDocType, SlotDocType } from '@/Schema'
import { Participant } from '@/api/participants'
import { StartGrid } from '@/components/StartGrid'

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
			<StartGrid data={data} columns='course'></StartGrid>
		</div>
	</>
	)
}
