import type {Slot as SlotType} from '@/api/slots'
import type {Participant as ParticipantType} from '@/api/participants'
import type { JSX } from 'react'
import { ParticipantStateIcon } from '../ParticipantStateIcon'
import { SvgIcon } from '../SvgIcon'
import { participantsTanCollection } from '@/database'
import { SlotStateTag } from '../SlotStateTag'
import { groupTag, ncTag } from '../Tags'

interface Properties {
    slot: SlotType
}

function displayNotAvailable():JSX.Element {
    return (
        <div className='border-2 border-solid rounded-md flex flex-row brightness-50'>
        <div className='flex flex-col p-1 italic'>NOT Available</div>
        <div className='flex flex-row p-1 items-center ml-auto'>
            <SvgIcon icon="dots-vertical"/>
        </div>
        </div>
    )
}

function displayAvailable():JSX.Element {
    return (
        <div className='border-2 border-solid rounded-md flex flex-row'>
        <SlotStateTag state="available"/>
        <div className='flex flex-col p-1 italic'>Available</div>
        <div className='flex flex-row p-1 items-center ml-auto'>
            <SvgIcon icon="dots-vertical"/>
        </div>
        </div>
    )
}

function displayParticipant(p:ParticipantType):JSX.Element {
    const notAttendingStyle:string = p.state === "notAttending" ? 'opacity-60 line-through' : ''
    return (
        <div className='border-2 border-solid rounded-md flex flex-row min-w-2xs'>
            <SlotStateTag state={p.state}/>
            <div className={`flex flex-col p-1 ${notAttendingStyle}`}>
                <span className='flex flex-row items-center'>
                    <span>{p.name} {groupTag(p)} {ncTag(p)}</span>
                </span>
                <span className='text-sm'>{p.club}</span>
            </div>
            <div className='flex flex-row p-1 items-center ml-auto'>
                <button 
                    className='bg-sky-200 rounded-sm p-1'
                    onClick={(e) => handleSetPresent2(e)}
                    data-participant-id={p.id}
                    >
                    <ParticipantStateIcon state="present"/>
                </button>
                <button 
                    className='rounded-sm p-1 bg-slate-600 ml-1'
                    >
                    <SvgIcon icon="dots-vertical"/>
                </button>
            </div>
        </div>
    )
}

function displayParticipants(participants:ParticipantType[]):JSX.Element {
    const cards = participants.map((p) => displayParticipant(p))
    return (
        <div>
            {cards}
        </div>
    )
}

async function handleSetPresent2(e:React.MouseEvent<HTMLButtonElement,MouseEvent>) {
    const participantId = e.currentTarget.getAttribute('data-participant-id');
    if (participantId === null) {
        return;
    }
    const p = participantsTanCollection.get(participantId)
    if (p?.state === "waiting") {
        participantsTanCollection.update(participantId, (p) => {p.state = "present"})
    } else if (p?.state === "present") {
        participantsTanCollection.update(participantId, (p) => {p.state = "waiting"})
    }
    return
}

export function Slot({slot}: Properties) {

    if (slot.isUsable === false) {
        return displayNotAvailable()
    } else if (slot.participants.length === 0) {
        return displayAvailable()
    } else if (slot.participants.length === 1) {
        return displayParticipant(slot.participants[0]!)
    } else {
        return displayParticipants(slot.participants)
    }
}