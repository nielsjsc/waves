import { ManagerActionButton } from "./ManagerActionButton"
import type { PopulatedEntry } from "@/utils/PopulatedEntry"
import { setNewEpunch } from "@/actions/participantActions"
import { useState, type ChangeEventHandler, } from "react"

interface Properties {
    participant:PopulatedEntry
    closeModal:Function
}

export function EditEpunchModal({participant, closeModal}:Properties) {

    const [newEpunchVal, setNewEpunchVal] = useState('')
    const [isRental, setIsRental] = useState<"unset"|"true"|"false">('unset')

    const handleNewEpunchInput:ChangeEventHandler<HTMLInputElement, HTMLInputElement> = e => {
        setNewEpunchVal(e.target.value)
    }

    function handleRentClick() {
        setIsRental("true")
    }

    function handleOwnClick() {
        setIsRental("false")
    }

    function handleSave() {
        //validate form
        if (newEpunchVal === null || newEpunchVal === undefined || !(/^\d{5,9}$/.test(newEpunchVal))) {
            alert("enter a valid epunch number (5-9 digits)")
            return
        }
        if (isRental == "unset") {
            alert("select rented or owned")
            return
        }

        //save the value
        setNewEpunch(participant.participant.id, newEpunchVal, isRental==="true" ? true : false)

        //close the modal
        closeModal()
    }

    return (
    <div className="flex flex-col gap-2">
        <p className="text-lg">Current e-punch: {participant.participant.epunch} {`${participant.participant.isRental ? "(Rental)" : "(Owned)"}`}</p>

        <div className="mt-4">
            <label htmlFor='new-si' className="text-lg">New e-punch </label>
            <input 
                id='new-si'
                type="text"
                pattern="[0-9]{5,9}"
                minLength={5}
                maxLength={9}
                className="border border-solid border-2 p-1 rounded text-lg"
                placeholder="1234567"
                onChange={handleNewEpunchInput}
                value={newEpunchVal}
            />
        </div>

        <div className="flex flex-row items-center">
                <span className="text-lg">Select &nbsp;</span>
                <ManagerActionButton 
                text={"Rental"} 
                action={handleRentClick} 
                icon={"arrow-cycle"} 
                color={"amber"} 
                buttonStyle={`${(isRental==="true") ? "solid" : "outline"}`} />
                &nbsp;or&nbsp;
                <ManagerActionButton 
                text={"Owned"} 
                action={handleOwnClick} 
                icon={"runner"} 
                color={"emerald"} 
                buttonStyle={`${(isRental==="false") ? "solid" : "outline"}`} />
        </div>

        <div className="flex flex-row gap-4 mt-6">
            <ManagerActionButton 
                text={"Save"} 
                action={handleSave} 
                icon={"arrow-box-right"} 
                color={"sky"} 
                buttonStyle={"solid"} />
            <ManagerActionButton 
                text={"Cancel"} 
                action={()=>closeModal()} 
                icon={"x"} 
                color={"red"} 
                buttonStyle={"outline"} />
        </div>

    </div>
)}