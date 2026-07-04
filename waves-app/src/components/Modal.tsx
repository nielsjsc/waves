import type { MouseEventHandler, ReactNode } from "react"
import { ManagerActionButton } from "./ManagerActionButton"

interface Properties {
    close: MouseEventHandler
    title: string
    content: ReactNode
}

export function Modal({close, title, content}:Properties) {
    return <div className="fixed top-0 left-0 h-[100vh] w-[100vw] z-40 bg-mauve-600/60">
        <div className="fixed top-24 left-16 right-16 z-50 border rounded border-4 border-white bg-gray-800 p-4 text-white">
            <div className="flex flex-row auto items-baseline">
                <span className="text-2xl grow">{title}</span>
                <ManagerActionButton 
                            text={"close"} 
                            action={close} 
                            icon={"x"} 
                            color={"amber"} 
                            buttonStyle={"outline"} />
            </div>
            <hr className="my-2"/>
            {content}
        </div>
    </div>
}