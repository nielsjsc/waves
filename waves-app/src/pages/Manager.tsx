import { changesTanCollection, participantsTanCollection, slotsTanCollection } from "@/database";
import { useLiveQuery } from "@tanstack/react-db";

import { Head } from "@/components/Head";
import { Header } from "@/components/Header";
import { useEffect, useRef, useState } from "react";
import { Search } from "@/components/Search";
import { hydrateParticipant } from "@/utils/hydrateParticipant";
import { SearchResultCard } from "@/components/SearchResultCard";
import { setNonCompetitive, setCompetitive, setStateNotAttending, setStateNoShow, setStateWaiting } from "@/actions/participantActions";
import { populateSlotData } from "@/utils/populateSlotData";
import { StartGrid } from "@/components/grid/StartGrid";
import { ManagerActionButton } from "@/components/ManagerActionButton";
import { getColorByIconName } from "@/utils/styleHelpers";


export function Manager() {

    const [isSearchOpen, setSearchOpen] = useState(false)
    const [selectedParticipantId, setSelectedParticipantId] = useState('')

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

    const selectedParticipantEntry = hydrateParticipant(selectedParticipantId, DATA)
 
    const slotsAtThisTime = selectedParticipantEntry?.time.startsWith('_') ? [] : populateSlotData(allSlots.filter(x => x.time === selectedParticipantEntry?.time), allParticipants)
    const slotsOnThisCourse = selectedParticipantEntry?.course === '' ? [] : populateSlotData(allSlots.filter(x => x.course === selectedParticipantEntry?.course), allParticipants)

    function toggleSearch() {
        if (isSearchOpen) {
            setSearchOpen(false);
        } else {
            setSearchOpen(true);
        }
    }

    function handleSearchSelection(newSelectedParticipantId:string) {
        setSelectedParticipantId(newSelectedParticipantId)
        const items = document.querySelectorAll(`[data-participant-id="${newSelectedParticipantId}"`)
        items.forEach((el) => el.scrollIntoView())
    }

    const searchOverlay = isSearchOpen ? 
            <div className="fixed top-0 left-0 h-[95vh] w-[95vw] m-8 border z-50 px-8 py-4 bg-gray-700 overflow-y-auto"
            >
                <Search setParticipant={handleSearchSelection} closeSearch={()=>setSearchOpen(false)}/>
            </div> :
            <div></div>

    const selectedParticipantCard = 
        (selectedParticipantId === '' || selectedParticipantEntry === undefined) ? <div className="italic"></div> :
        <SearchResultCard entry={selectedParticipantEntry} highlight={true} />

    const competitiveToggle = selectedParticipantEntry === undefined ? <></> :
    selectedParticipantEntry!.participant.isNonCompete ? 
        <ManagerActionButton
            text="Set Competitive"
            action={()=>setCompetitive(selectedParticipantId)}
            icon="medal" 
            color="purple"
            buttonStyle="outline" /> 
        : <ManagerActionButton
            text="Set Non-Competitive"
            action={()=>setNonCompetitive(selectedParticipantId)}
            icon="medal" 
            color="purple"
            buttonStyle="outline" />  

    const actionsOrSearchPrompt = selectedParticipantEntry === undefined ? 
        <div className="">Select a participant to populate actions</div> :
        <div className="flex flex-row gap-4">
            <div className="flex flex-wrap flex-col p-1 gap-2">
                <ManagerActionButton 
                    action={()=>{alert("not yet implemented")}}
                    text="Edit Name"
                    icon="pencil" 
                    color={getColorByIconName("pencil")}
                    buttonStyle="outline" />
                <ManagerActionButton 
                    action={()=>{alert("not yet implemented")}}
                    text="Edit Epunch"
                    icon="pencil" 
                    color={getColorByIconName("pencil")}
                    buttonStyle="outline" />
                <ManagerActionButton 
                    action={()=>{alert("not yet implemented")}}
                    text="Change Class/Course"
                    icon="pencil" 
                    color={getColorByIconName("pencil")}
                    buttonStyle="outline" />
            </div>
            <div className="flex flex-wrap flex-col p-1 gap-2">
                {competitiveToggle}
                <ManagerActionButton 
                    action={()=>{alert("not yet implemented")}}
                    text="Change Group"
                    icon="group" 
                    color={getColorByIconName("group")}
                    buttonStyle="outline" />
            </div>
            <div className="flex flex-wrap flex-col p-1 gap-2">
                <ManagerActionButton 
                    action={()=>setStateNotAttending(selectedParticipantId, selectedParticipantEntry!.slotId, selectedParticipantEntry!.course)}
                    text="Not Attending"
                    icon="x" 
                    color={getColorByIconName("x")}
                    buttonStyle="outline" />
                <ManagerActionButton 
                    action={()=>setStateNoShow(selectedParticipantId, selectedParticipantEntry.participant.state)}
                    text="No Show"
                    icon="question-circle" 
                    color={getColorByIconName("question-circle")}
                    buttonStyle="outline" />
                <ManagerActionButton 
                    action={()=>{alert("not yet implemented")}}
                    text="Needs New Time"
                    icon="hourglass" 
                    color={getColorByIconName("hourglass")}
                    buttonStyle="outline" />
                <ManagerActionButton 
                    action={()=>setStateWaiting(selectedParticipantId)}
                    text="Reset / Waiting"
                    icon="clock" 
                    color={getColorByIconName("clock")}
                    buttonStyle="outline" />
            </div>
        </div>

    const scrollToElementRef = useRef<HTMLTableRowElement>(null);

    useEffect(() => {
        if (scrollToElementRef.current !== null) {
            scrollToElementRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [selectedParticipantId])
    
    return (
        <>
            <Head title='Start Manager' />
            <div className="flex flex-col">
                <Header/>

                <div className="container mx-auto flex flex-col items-center">

                    {searchOverlay}

                    <div className="flex flex-row">
                    <div className="flex flex-col mt-2 p-1 items-center gap-2">
                        <ManagerActionButton
                            action={toggleSearch}
                            text="Search"
                            icon="search" 
                            color="pink"
                            buttonStyle="solid" />
                        <div>
                            {selectedParticipantCard}
                        </div>
                        
                    </div>

                    <div className="flex flex-col items-center">
                    <h3 className="text-2xl mt-2">Actions</h3>
                    {actionsOrSearchPrompt}
                    </div>
                    </div>

                    <div className="flex flex-row flex-wrap mt-4"> {/*Slot Lists*/}
                        <div className="flex flex-col min-w-md">
                            <h3 className="text-2xl text-center">All starts at {selectedParticipantEntry?.time}</h3>
                            <div className="max-h-155 overflow-scroll">
                            <StartGrid 
                                data={slotsAtThisTime}
                                selectedParticipantHydrated={selectedParticipantEntry}
                                columns="time"
                                toStateButtons={[]} />
                            </div>
                        </div>
                        <div className="flex flex-col min-w-md">
                            <h3 className="text-2xl text-center">All starts on course {selectedParticipantEntry?.course}</h3>
                            <div className="max-h-155 overflow-scroll">
                            <StartGrid 
                                data={slotsOnThisCourse} 
                                selectedParticipantHydrated={selectedParticipantEntry}
                                columns="course" 
                                scrollTo={scrollToElementRef}
                                toStateButtons={[]}/>
                            </div>
                        </div>
                    </div> {/*Slot Lists*/}

                </div> {/*body area*/}
            </div> {/*page*/}
            
            
        </>
    )
}