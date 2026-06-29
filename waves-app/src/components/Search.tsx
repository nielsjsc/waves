import { participantsTanCollection, slotsTanCollection } from "@/database";
import type { ParticipantDocType } from "@/Schema";
import { populateSlotData } from "@/utils/populateSlotData";
import { useLiveQuery } from "@tanstack/react-db";
import { useEffect, useState } from "react";
import { pivotSlotsToEntries, } from "@/utils/pivotSlotsToEntries";
import { SearchResultCard } from "@/components/SearchResultCard";

interface Properties {
    setParticipant:Function
    closeSearch:Function
}

export function Search({setParticipant, closeSearch}:Properties) {

    const [nameQuery, setNameQuery] = useState('');
    const [nameQueryDebounced, setNameQueryDebounced] = useState('');
    const [clubQuery, setClubQuery] = useState('');
    const [clubQueryDebounced, setClubQueryDebounced] = useState('');
    const [siQuery, setSiQuery] = useState('');
    const [siQueryDebounced, setSiQueryDebounced] = useState('');

    const {data: allParticipants} = useLiveQuery((q) =>
        q.from({participant: participantsTanCollection})
    )

    const {data: allSlots} = useLiveQuery((q) =>
        q.from({slot: slotsTanCollection})
    )

    function searchByName(q:string):ParticipantDocType[] {
        if (q.length < 2) {
            return []
        }
        return (allParticipants.filter(x => x.name.toLocaleLowerCase().includes(q.toLocaleLowerCase()))) 
    }

    function searchByClub(q:string):ParticipantDocType[] {
        if (q.length < 2) {
            return []
        }
        return(allParticipants.filter(x => x.club?.toLocaleLowerCase().includes(q.toLocaleLowerCase())))
    }

    function searchBySi(q:string):ParticipantDocType[] {
        if (q.length < 2) {
            return []
        }
        return(allParticipants.filter(x => x.epunch?.includes(q)))
    }

    function commonSearchResults(a:ParticipantDocType[], b:ParticipantDocType[], c:ParticipantDocType[]):ParticipantDocType[] {
        if (a.length === 0 && b.length === 0 && c.length === 0) {
            return(allParticipants)
        }
        
        if (a.length !== 0 && b.length === 0 && c.length === 0) {
            return a
        }
        if (a.length === 0 && b.length !== 0 && c.length === 0) {
            return b
        }
        if (a.length === 0 && b.length === 0 && c.length !== 0) {
            return c
        }
        
        if (a.length !== 0 && b.length !== 0 && c.length === 0) {
            return a.filter(x => b.includes(x))
        }
        if (a.length !== 0 && b.length === 0 && c.length !== 0) {
            return a.filter(x => c.includes(x))
        }
        if (a.length === 0 && b.length !== 0 && c.length !== 0) {
            return b.filter(x => c.includes(x))
        }
            
        return(a.filter(x => b.includes(x)).filter(y => c.includes(y)))
    }

    function getParticipantSlots(participants:ParticipantDocType[]) {
        const pids:string[] = participants.map(x => x.id)
        return (allSlots.filter(x => x.participants.some(x => pids.includes(x))))
    }

    const handleNameQueryChange = (event:React.ChangeEvent<HTMLInputElement>) => {
        event.preventDefault();
        setNameQuery(event.target.value);
    }
    useEffect(() => {
        const nameDebouncer = setTimeout(() => setNameQueryDebounced(nameQuery), 500);
        return () => clearTimeout(nameDebouncer)
        }, 
        [nameQuery, 500]
    )

    const handleClubQueryChange = (event:React.ChangeEvent<HTMLInputElement>) => {
        event.preventDefault();
        setClubQuery(event.target.value);
    }
    useEffect(() => {
        const clubDebouncer = setTimeout(() => setClubQueryDebounced(clubQuery), 500);
        return () => clearTimeout(clubDebouncer)
        }, 
        [clubQuery, 500]
    )

    const handleSiQueryChange = (event:React.ChangeEvent<HTMLInputElement>) => {
        event.preventDefault();
        setSiQuery(event.target.value);
    }
    useEffect(() => {
        const siDebouncer = setTimeout(() => setSiQueryDebounced(siQuery), 500);
        return () => clearTimeout(siDebouncer)
        }, 
        [siQuery, 500]
    )

    const nameQueryResults = searchByName(nameQueryDebounced)
    const clubQueryResults = searchByClub(clubQueryDebounced)
    const siQueryResults = searchBySi(siQueryDebounced)
    const combinedResults = commonSearchResults(nameQueryResults, clubQueryResults, siQueryResults)
    const populatedSlots = populateSlotData(getParticipantSlots(combinedResults), combinedResults)
    const entries = pivotSlotsToEntries(populatedSlots).sort((a,b) => (a.participant.name.localeCompare(b.participant.name)))


    function handleEntryClick(e:React.MouseEvent<HTMLDivElement,MouseEvent>) {
        setParticipant(e.currentTarget.getAttribute('data-participant-id'))
        closeSearch()
    }

    function handleCloseClick(e:React.MouseEvent<HTMLDivElement,MouseEvent>) {
        closeSearch()
    }

    return (
        <>
            <div onClick={handleCloseClick} className="relative">
                <button className="absolute top-2 right-2 px-2 py-1 rounded-sm hover:bg-rose-500/50">Close Search</button>
            </div>
            <div className='flex flex-col'>
                <div className='text-base p-2'>
                    <div>
                        <form className="my-1">
                            <label htmlFor='search-name' className="text-lg">Search by Name: </label>
                            <input 
                                id='search-name'
                                type="text"
                                className="border border-solid border-2 p-1 rounded text-lg"
                                placeholder="name"
                                onChange={handleNameQueryChange}
                                value={nameQuery}
                            />
                        </form>
                        <form className="my-1">
                            <label htmlFor='search-club' className="text-lg">Search by School/Club: </label>
                            <input 
                                id='search-club'
                                type="text"
                                className="border border-solid border-2 p-1 rounded text-lg"
                                placeholder="school / club"
                                onChange={handleClubQueryChange}
                                value={clubQuery}
                            />
                        </form>
                        <form className="my-1">
                            <label htmlFor='search-si' className="text-lg">Search by SI Epunch #: </label>
                            <input 
                                id='search-si'
                                type="text"
                                className="border border-solid border-2 p-1 rounded text-lg"
                                placeholder="1234567"
                                onChange={handleSiQueryChange}
                                value={siQuery}
                            />
                        </form>
                    </div>
                    <hr className="mt-2"/>
                    <div className="flex flex-wrap">
                        {entries.map(e => 
                            <div onClick={handleEntryClick} data-participant-id={e.participant.id} key={e.participant.id} className="hover:bg-blue-500/50 rounded-lg">
                                <SearchResultCard entry={e} highlight={false} key={e.participant.id}/>
                            </div>
                        )}
                    </div> 
                </div>  
            </div>
        </>
    )
}