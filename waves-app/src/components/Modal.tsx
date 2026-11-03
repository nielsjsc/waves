import type { MouseEventHandler, ReactNode } from "react"
import { ManagerActionButton } from "./ManagerActionButton"

interface Properties {
    close: MouseEventHandler
    title: string
    content: ReactNode
}

export function Modal({close, title, content}:Properties) {
    return (
        <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"
            onClick={close}>
            <div
                className="z-50 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border-2 border-gray-600 bg-gray-800 p-5 text-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-row items-center justify-between gap-3">
                    <span className="text-xl font-bold">{title}</span>
                    <ManagerActionButton
                        text={"Close"}
                        action={close}
                        icon={"x"}
                        color={"red"}
                        buttonStyle={"outline"} />
                </div>
                <hr className="my-3 border-gray-700" />
                {content}
            </div>
        </div>
    )
}
