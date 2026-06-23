import {Head} from '@/components/Head'
import { Header } from '@/components/Header'
import { useLiveQuery } from '@tanstack/react-db'
import { participantsTanCollection, slotsTanCollection } from '@/database'
import { StartGrid } from '@/components/grid/StartGrid'
import { populateSlotData } from '@/utils/populateSlotData'


export function Callup() {

	const {data: allSlots} = useLiveQuery((q) =>
		q.from({slot: slotsTanCollection})
	)

	const {data: allParticipants} = useLiveQuery((q) =>
		q.from({participant: participantsTanCollection})
	)

	const data = populateSlotData(allSlots, allParticipants)

	return (
	<>
		<Head title='Tent 1: Call-up' />
		<Header/>
		<div className='flex flex-col'>
			<StartGrid data={data} columns='course'></StartGrid>
		</div>
	</>
	)
}
