import { useEffect, useRef, useState } from 'react'
import type { PopulatedEntry } from '@/utils/PopulatedEntry'
import { setHasRentedCompass } from '@/actions/participantActions'

interface Properties {
    participant: PopulatedEntry
    closeModal: () => void
    onSaved?: (compassId: string) => void
}

export function RentCompassModal({ participant, closeModal, onSaved }: Properties) {
    const [compassIdInput, setCompassIdInput] = useState(participant.participant.compassId ?? '')
    const [confirmNoId, setConfirmNoId] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
    }, [])

    async function commitSave(cleanId: string) {
        if (isSaving) return
        setIsSaving(true)
        try {
            await setHasRentedCompass(participant.participant.id, true, cleanId)
            onSaved?.(cleanId)
            closeModal()
        } catch {
            setErrorMessage('Failed to save compass rental. Please try again.')
            setIsSaving(false)
        }
    }

    async function handleSave() {
        if (isSaving) return
        const cleanId = compassIdInput.trim()
        if (cleanId === '' && !confirmNoId) {
            setConfirmNoId(true)
            return
        }
        await commitSave(cleanId)
    }

    return (
        <div className="flex flex-col gap-3 text-slate-900">
            <div>
                <label
                    htmlFor="rent-compass-id-input"
                    className="block text-sm font-semibold text-slate-800">
                    Compass ID
                </label>
                <input
                    ref={inputRef}
                    id="rent-compass-id-input"
                    type="text"
                    value={compassIdInput}
                    onChange={(e) => {
                        setCompassIdInput(e.target.value)
                        if (confirmNoId) setConfirmNoId(false)
                        if (errorMessage) setErrorMessage('')
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault()
                            void handleSave()
                        } else if (e.key === 'Escape') {
                            e.preventDefault()
                            closeModal()
                        }
                    }}
                    placeholder="Enter compass ID (or leave blank)…"
                    className="mt-1 w-full rounded-none border border-slate-400 bg-white px-3 py-2 text-lg font-bold tabular-nums text-slate-950 placeholder-slate-400 focus:border-slate-950 focus:outline-none"
                />
            </div>

            {confirmNoId && (
                <div
                    role="alert"
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-amber-700 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
                    <span className="font-semibold">
                        Rent compass without an ID? Are you sure?
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => void commitSave('')}
                            className="min-h-9 border border-amber-800 bg-amber-700 px-3 py-1 text-xs font-bold text-white hover:bg-amber-800 disabled:opacity-50">
                            Yes, rent without ID
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setConfirmNoId(false)
                                inputRef.current?.focus()
                            }}
                            className="min-h-9 border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                            No
                        </button>
                    </div>
                </div>
            )}

            {errorMessage !== '' && (
                <p role="alert" className="text-xs font-semibold text-red-700">
                    {errorMessage}
                </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
                <button
                    type="button"
                    onClick={closeModal}
                    className="min-h-10 border border-slate-300 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                    Cancel
                </button>
                <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => void handleSave()}
                    className="min-h-10 border border-amber-800 bg-amber-600 px-5 py-1.5 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50">
                    {isSaving ? 'Saving…' : 'Rent Compass'}
                </button>
            </div>
        </div>
    )
}
