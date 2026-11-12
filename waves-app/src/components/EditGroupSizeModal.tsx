import { useState, type ChangeEventHandler, type KeyboardEventHandler } from 'react'
import { ManagerActionButton } from './ManagerActionButton'
import type { PopulatedEntry } from '@/utils/PopulatedEntry'
import { setGroupSize } from '@/actions/participantActions'

interface Properties {
    participant: PopulatedEntry
    closeModal: () => void
    onSaved?: (oldSize: number, newSize: number) => void
}

const PRESET_SIZES = [1, 2, 3, 4, 5, 6]

export function EditGroupSizeModal({ participant, closeModal, onSaved }: Properties) {
    const currentSize = Math.max(1, Math.round(participant.participant.groupSize || 1))
    const [sizeInput, setSizeInput] = useState<string>(String(currentSize))
    const [errorMessage, setErrorMessage] = useState<string>('')
    const [isSaving, setIsSaving] = useState(false)

    const parsedSize = parseInt(sizeInput, 10)
    const isValidSize = !Number.isNaN(parsedSize) && parsedSize >= 1 && parsedSize <= 99

    const handleInputChange: ChangeEventHandler<HTMLInputElement> = (e) => {
        setErrorMessage('')
        setSizeInput(e.target.value.trim())
    }

    function selectSize(n: number) {
        setErrorMessage('')
        const clamped = Math.max(1, Math.min(99, n))
        setSizeInput(String(clamped))
    }

    async function handleSave() {
        if (isSaving) return
        if (!isValidSize) {
            setErrorMessage('Please enter a valid number of people (1 or more).')
            return
        }
        if (parsedSize === currentSize) {
            closeModal()
            return
        }
        setIsSaving(true)
        try {
            await setGroupSize(participant.participant.id, parsedSize)
            onSaved?.(currentSize, parsedSize)
            closeModal()
        } catch {
            setErrorMessage('Failed to save group size. Please try again.')
            setIsSaving(false)
        }
    }

    const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            void handleSave()
        }
    }

    return (
        <div className="flex flex-col gap-3 text-slate-900">
            <p className="text-base sm:text-lg">
                Current entry:{' '}
                <strong className="font-bold text-slate-950">
                    {currentSize === 1 ? 'Individual (1 person)' : `Group of ${currentSize} people`}
                </strong>
            </p>

            <div className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-slate-700">Quick select number of people</span>
                <div className="flex flex-wrap gap-1.5">
                    {PRESET_SIZES.map((n) => {
                        const active = isValidSize && parsedSize === n
                        return (
                            <button
                                key={n}
                                type="button"
                                onClick={() => selectSize(n)}
                                className={`min-h-10 sm:min-h-9 border px-3 py-1.5 text-sm font-bold transition ${
                                    active
                                        ? 'border-slate-900 bg-slate-900 text-white'
                                        : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                                }`}>
                                {n === 1 ? '1 (Individual)' : `Group (${n})`}
                            </button>
                        )
                    })}
                </div>
            </div>

            <div className="mt-1 flex flex-col gap-1">
                <label htmlFor="group-size-input" className="text-sm font-semibold text-slate-700">
                    Number of people in group
                </label>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        aria-label="Decrease group size"
                        onClick={() => selectSize((isValidSize ? parsedSize : currentSize) - 1)}
                        disabled={isValidSize && parsedSize <= 1}
                        className="min-h-11 min-w-[3rem] border border-slate-400 bg-white px-3.5 py-2 text-lg font-bold text-slate-900 hover:bg-slate-100 disabled:opacity-40">
                        -
                    </button>
                    <input
                        id="group-size-input"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={99}
                        autoFocus
                        value={sizeInput}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        className="min-h-11 w-28 rounded-none border border-slate-400 bg-white px-3 py-2 text-center font-mono text-xl font-bold tabular-nums text-slate-900 focus:border-slate-900 focus:outline-none"
                    />
                    <button
                        type="button"
                        aria-label="Increase group size"
                        onClick={() => selectSize((isValidSize ? parsedSize : currentSize) + 1)}
                        className="min-h-11 min-w-[3rem] border border-slate-400 bg-white px-3.5 py-2 text-lg font-bold text-slate-900 hover:bg-slate-100">
                        +
                    </button>
                    <span className="text-sm font-medium text-slate-600">
                        {isValidSize
                            ? parsedSize === 1
                                ? 'Individual runner (1 person)'
                                : `Group (${parsedSize} people)`
                            : ''}
                    </span>
                </div>
            </div>

            {errorMessage !== '' && (
                <div
                    role="alert"
                    className="border border-amber-600 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
                    {errorMessage}
                </div>
            )}

            <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:gap-3">
                <ManagerActionButton
                    text={isSaving ? "Saving..." : "Save"}
                    action={() => void handleSave()}
                    icon="arrow-box-right"
                    color="sky"
                    buttonStyle="solid"
                    className="w-full sm:w-auto min-h-10"
                />
                <ManagerActionButton
                    text="Cancel"
                    action={closeModal}
                    icon="x"
                    color="red"
                    buttonStyle="outline"
                    className="w-full sm:w-auto min-h-10"
                />
            </div>
        </div>
    )
}
