import {Head} from '@/components/Head'
import { useLiveQuery } from '@tanstack/react-db'
import { changesTanCollection, participantsTanCollection, slotsTanCollection } from '@/database'
import { hydrateChange } from '@/utils/hydrateChange'
import { SvgIcon } from '@/components/SvgIcon'


export function Changes() {

    const {data: allParticipants} = useLiveQuery((q) =>
        q.from({participant: participantsTanCollection})
    )
    const {data: allSlots} = useLiveQuery((q) =>
        q.from({slot: slotsTanCollection})
    )
    const {data: allChanges} = useLiveQuery((q) =>
        q.from({changes: changesTanCollection})
    )

    const DATA = {
        participants: allParticipants,
        slots: allSlots,
        changes: allChanges
    }

    const changes = allChanges.map((x) => hydrateChange(x.id, DATA)).filter((x)=>x !== undefined).sort((a,b) => a.changedAt.getTime() - b.changedAt.getTime())

    return (
    <>
        <Head title='Track Changes' />
        <div className='flex flex-col gap-4'>
            {changes.map((c) => {return(
                <div className='flex flex-col'>
                    <p>{c?.participant.name} changed at {c?.changedAt.toISOString()}</p>
                    <p>Change Type: {c?.changeType}</p>
                    <p className='flex flex-row gap-2'>
                        <span className='line-through'>{c?.old}</span>
                        <SvgIcon icon="right"/>
                        <span>{c?.new}</span>
                    </p>
                </div>
                )}
            )}
        </div>
    </>
    )
}
