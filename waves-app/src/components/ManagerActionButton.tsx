import type { MouseEventHandler } from "react"
import { SvgIcon } from "./SvgIcon"

interface Properties {
    text: string
    action: MouseEventHandler
    icon: string
    color: string
    buttonStyle: 'solid'|'outline'
}

function buttonStyleClasses(buttonStyle:string, color:string):string {
    // I'm not sure why parameterizing this doesn't work, but it doesn't, so here's a giant switch

    if (buttonStyle === 'outline') {
        switch (color) {
            case "red":
                return "border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
            case "orange":
                return "border-orange-600 text-orange-600 hover:bg-orange-600 hover:text-white"
            case "amber":
                return "border-amber-600 text-amber-600 hover:bg-amber-600 hover:text-white"
            case "yellow":
                return "border-yellow-600 text-yellow-600 hover:bg-yellow-600 hover:text-white"
            case "emerald":
                return "border-emerald-600 text-emerald-600 hover:bg-emerald-600 hover:text-white"
            case "sky":
                return "border-sky-600 text-sky-600 hover:bg-sky-600 hover:text-white"
            case "purple":
                return "border-purple-600 text-purple-600 hover:bg-purple-600 hover:text-white"
            case "fuchsia":
                return "border-fuchsia-600 text-fuchsia-600 hover:bg-fuchsia-600 hover:text-white"
            case "pink":
                return "border-pink-600 text-pink-600 hover:bg-pink-600 hover:text-white"
            case "mauve":
                return "border-mauve-600 text-mauve-600 hover:bg-mauve-600 hover:text-white"
            default:
                return "border-sky-600 text-sky-600 hover:bg-sky-600 hover:text-white"
        }
    } else { // solid
        switch (color) {
            case "red":
                return "border-red-900 bg-red-600 text-white hover:bg-red-800 hover:border-white"
            case "orange":
                return "border-orange-900 bg-orange-600 text-white hover:bg-orange-800 hover:border-white"
            case "amber":
                return "border-amber-900 bg-amber-600 text-white hover:bg-amber-800 hover:border-white"
            case "yellow":
                return "border-yellow-900 bg-yellow-600 text-white hover:bg-yellow-800 hover:border-white"
            case "emerald":
                return "border-emerald-900 bg-emerald-600 text-white hover:bg-emerald-800 hover:border-white"
            case "sky":
                return "border-sky-900 bg-sky-600 text-white hover:bg-sky-800 hover:border-white"
            case "purple":
                return "border-purple-900 bg-purple-600 text-white hover:bg-purple-800 hover:border-white"
            case "fuchsia":
                return "border-fuchsia-900 bg-fuchsia-600 text-white hover:bg-fuchsia-800 hover:border-white"
            case "pink":
                return "border-pink-900 bg-pink-600 text-white hover:bg-pink-800 hover:border-white"
            case "mauve":
                return "border-mauve-900 bg-mauve-600 text-white hover:bg-mauve-800 hover:border-white"
            default:
                return "border-sky-900 bg-sky-600 text-white hover:bg-sky-800 hover:border-white"
        }
    }
}

export function ManagerActionButton({text, action, icon, color, buttonStyle}: Properties) {

    const styling = "rounded border px-2 py-1" + " " + buttonStyleClasses(buttonStyle, color)

    return(
    <button 
        className={styling}
        onClick={action}
    >
        <span className="flex flex-column gap-1">
            <SvgIcon icon={icon}/>
            {text}
        </span>
    </button>
    )
}