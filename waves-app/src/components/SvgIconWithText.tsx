import { SvgIcon } from "./SvgIcon"

interface Properties {
    icon: string
    text: string
}

export function SvgIconWithText({icon, text}: Properties) {
    return <span className="flex flex-column gap-1">
            <SvgIcon icon={icon}/>
            {text}
        </span>
}