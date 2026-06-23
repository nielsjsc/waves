import type { MouseEventHandler } from "react"
import { SvgIcon } from "./SvgIcon"


interface Properties {
    text: string
    action: MouseEventHandler
    icon: string
}

export function ManagerActionButton({text, action, icon}: Properties) {

    function buttonStyle(icon:string):string {
        switch (icon) {
            case "x":
                return "border-mauve-900 bg-mauve-600 text-white hover:bg-mauve-700"
            case "medal":
                return "border-indigo-900 bg-indigo-600 text-white hover:bg-indigo-700"
            case "group":
                return "border-emerald-900 bg-emerald-600 text-white hover:bg-emerald-700"
        }
        return "hover:bg-black"
    }

    return(
    <button 
        className={`rounded border px-2 py-1 ${buttonStyle(icon)}`}
        onClick={action}
    >
        <span className="flex flex-column">
            <SvgIcon icon={icon}/>
            {text}
        </span>
    </button>
    )
}