import {Head} from '@/components/Head'
import { useLiveQuery } from '@tanstack/react-db'
import { participantsTanCollection, slotsTanCollection } from '@/database'
import { StartGrid } from '@/components/grid/StartGrid'
import { populateSlotData } from '@/utils/populateSlotData'


export function FullGrid() {

	const {data: allSlots} = useLiveQuery((q) =>
		q.from({slot: slotsTanCollection})
	)

	const {data: allParticipants} = useLiveQuery((q) =>
		q.from({participant: participantsTanCollection})
	)

	const data = populateSlotData(allSlots, allParticipants)

	return (
	<>
		<Head title='Start Grid' />
		<div className='flex flex-col'>
			<StartGrid 
				data={data} 
				columns='course' 
				selectedParticipantHydrated={undefined}
				toStateButtons={[]} />
		</div>
	</>
	)
}
