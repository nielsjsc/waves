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
