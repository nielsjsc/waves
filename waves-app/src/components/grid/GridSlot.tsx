import { type Slot as SlotType } from '@/api/slots'
import type {ParticipantState, Participant as ParticipantType} from '@/api/participants'
import { type JSX } from 'react'
import { SvgIcon } from '../SvgIcon'
import { SlotStateTag } from '../SlotStateTag'
import { groupTag, ncTag } from '../Tags'
import { setNewStartTime, } from '@/actions/participantActions'
import type { PopulatedEntry } from '@/utils/PopulatedEntry'
import { ParticipantStateChangeButton } from './ParticipantStateChangeButton'
import { ColorStyles } from '@/utils/styleHelpers'

interface Properties {
    slot: SlotType
    selectedParticipantHydrated:PopulatedEntry|undefined,
    itemOnClick: undefined
    toStateButtons: ParticipantState[]
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

function displayAvailable(slot:SlotType, selectedParticipantHydrated:PopulatedEntry|undefined):JSX.Element {
    // TODO
    // if someone is selected NOT on this course, then need to prompt for a new class before assigning to this time/slot

    function assignButton():JSX.Element {
        if (selectedParticipantHydrated === undefined){
            return <></>
        }

        if (selectedParticipantHydrated.course === slot.course) {
            return (
            <div className='flex flex-row p-1 items-center ml-auto'>
                <button 
                    className={`rounded m-1 px-2 py-1 border border-2 border-amber-600/80 text-amber-300/60 hover:bg-amber-600/80 hover:text-white`}
                    onClick={()=>setNewStartTime(selectedParticipantHydrated.participant.id, selectedParticipantHydrated.slotId, slot.id)} >
                    <span className="flex flex-column">
                        <SvgIcon icon="arrow-box-right"/>
                        <span className='text-sm place-self-center'>Assign</span>
                    </span>
                </button>
            </div>
        )} else {
            return <></>
        }
    }

    return (
        <div className='border-2 border-solid rounded-md flex flex-row items-stretch'>
            <SlotStateTag state="available"/>
            <span className='p-1 italic place-self-center text-amber-100/60'>Available</span>
            {/* {button} */}
            {assignButton()}
        </div>
    )
}

function displayParticipant(p:ParticipantType, highlightEntry:PopulatedEntry|undefined, itemOnClick:undefined, toStateButtons:ParticipantState[]):JSX.Element {
    const notAttendingStyle:string = p.state === "notAttending" ? 'opacity-60 line-through' : ''
    const borderColor:string = p.id === highlightEntry?.participant.id ? `border-4 ${ColorStyles.get('pink')!.border} ${ColorStyles.get('pink')!.bgDark} text-white` : ''

    function buttons():JSX.Element {
        if (toStateButtons === undefined) {return <></>}
        else if (toStateButtons.length === 0) {return <></>}
        else {
            return (
            <div className='flex flex-col gap-1'>
            {toStateButtons.map((toState) => {return(
                <ParticipantStateChangeButton
                    participant={p}
                    toState={toState}
                />
                )}
            )}
            </div>)
        }
    }

    return (
        <div className={`border-2 border-solid ${borderColor} rounded-md flex flex-row min-w-2xs`} key={p.id} data-participant-id={p.id}>
            <SlotStateTag state={p.state}/>
            <div className={`flex flex-col p-1 ${notAttendingStyle}`}>
                <span className='flex flex-row items-center'>
                    <span>{p.name} {groupTag(p)} {ncTag(p)}</span>
                </span>
                <span className='text-sm'>{p.club}</span>
            </div>
            <div className='flex flex-row p-1 items-center ml-auto'>
                {buttons()}
            </div>
        </div>
    )
}

function displayParticipants(participants:ParticipantType[], highlightEntry:PopulatedEntry|undefined, itemOnClick:undefined, toStateButtons:ParticipantState[]):JSX.Element {
    const cards = participants.map((p) => displayParticipant(p, highlightEntry, itemOnClick, toStateButtons))
    return (
        <div>
            {cards}
        </div>
    )
}

export function GridSlot({slot, selectedParticipantHydrated, itemOnClick, toStateButtons}: Properties) {

    if (slot.isUsable === false) {
        return displayNotAvailable()
    } else if (slot.participants.length === 0) {        
        return displayAvailable(slot, selectedParticipantHydrated)
    } else {
        return displayParticipants(slot.participants, selectedParticipantHydrated, itemOnClick, toStateButtons)
    }
}