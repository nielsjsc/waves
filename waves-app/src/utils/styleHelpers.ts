import { type ParticipantState } from "@/api/participants"

interface ColorStyle {
    text: string
    textDark: string
    border: string
    borderDark: string
    bg: string
    bgLight: string
    bgDark: string
    bgHover: string
    bgDarkHover: string
}

interface ParticipantStateStyle {
    friendlyName: string
    iconName: string
    text: string
    textDark: string
    border: string
    borderDark: string
    bg: string
    bgLight: string
    bgDark: string
    bgHover: string
    bgDarkHover: string
}

// Update color styles below when updating state styles
export const ParticipantStateStyles:Map<ParticipantState|"available",ParticipantStateStyle> = new Map([
    ['waiting', {
        friendlyName: "Waiting",
        iconName: "clock",
        text: "text-purple-600",
        textDark: "text-purple-800",
        border: "border-purple-600",
        borderDark: "border-purple-800",
        bg: "bg-purple-600",
        bgLight: "bg-purple-300",
        bgDark: "bg-purple-800",
        bgHover: "hover:bg-purple-600",
        bgDarkHover: "hover:bg-purple-800",
    }],
    ['present', {
        friendlyName: "Present",
        iconName: "pin",
        text: "text-sky-600",
        textDark: "text-sky-800",
        border: "border-sky-600",
        borderDark: "border-sky-800",
        bg: "bg-sky-600",
        bgLight: "bg-sky-300",
        bgDark: "bg-sky-800",
        bgHover: "hover:bg-sky-600",
        bgDarkHover: "hover:bg-sky-800",
    }],
    ['noShow', {
        friendlyName: "No Show",
        iconName: "question-circle",
        text: "text-red-600",
        textDark: "text-red-800",
        border: "border-red-600",
        borderDark: "border-red-800",
        bg: "bg-red-700",
        bgLight: "bg-red-300",
        bgDark: "bg-red-900",
        bgHover: "hover:bg-red-600",
        bgDarkHover: "hover:bg-red-800",
    }],
    ['validated', {
        friendlyName: "Validated",
        iconName: "check-badge",
        text: "text-emerald-600",
        textDark: "text-emerald-800",
        border: "border-emerald-600",
        borderDark: "border-emerald-800",
        bg: "bg-emerald-600",
        bgLight: "bg-emerald-300",
        bgDark: "bg-emerald-800",
        bgHover: "hover:bg-emerald-600",
        bgDarkHover: "hover:bg-emerald-800",
    }],
    ['wrongEpunch', {
        friendlyName: "Wrong E-punch",
        iconName: "triangle-bang",
        text: "text-amber-500",
        textDark: "text-amber-800",
        border: "border-amber-600",
        borderDark: "border-amber-800",
        bg: "bg-amber-600",
        bgLight: "bg-amber-300",
        bgDark: "bg-amber-800",
        bgHover: "hover:bg-amber-600",
        bgDarkHover: "hover:bg-amber-800",
    }],
    ['notAttending', {
        friendlyName: "Not Attending",
        iconName: "x",
        text: "text-mauve-400",
        textDark: "text-mauve-600",
        border: "border-mauve-600",
        borderDark: "border-mauve-800",
        bg: "bg-mauve-600",
        bgLight: "bg-mauve-300",
        bgDark: "bg-mauve-800",
        bgHover: "hover:bg-mauve-600",
        bgDarkHover: "hover:bg-mauve-800",
    }],
    ['needsAssignment', {
        friendlyName: "Needs New Time",
        iconName: "hourglass",
        text: "text-orange-600",
        textDark: "text-orange-800",
        border: "border-orange-600",
        borderDark: "border-orange-800",
        bg: "bg-orange-600",
        bgLight: "bg-orange-300",
        bgDark: "bg-orange-800",
        bgHover: "hover:bg-orange-600",
        bgDarkHover: "hover:bg-orange-800",
    }],
    ['available', {
        friendlyName: "Available",
        iconName: "tag",
        text: "text-orange-600",
        textDark: "text-orange-800",
        border: "border-orange-600",
        borderDark: "border-orange-800",
        bg: "bg-orange-600",
        bgLight: "bg-orange-300",
        bgDark: "bg-orange-800",
        bgHover: "hover:bg-orange-600",
        bgDarkHover: "hover:bg-orange-800",
    }],
    ['started', {
        friendlyName: "Started",
        iconName: "runner",
        text: "text-sky-600",
        textDark: "text-sky-800",
        border: "border-sky-600",
        borderDark: "border-sky-800",
        bg: "bg-sky-600",
        bgLight: "bg-sky-300",
        bgDark: "bg-sky-800",
        bgHover: "hover:bg-sky-600",
        bgDarkHover: "hover:bg-sky-800",
    }]
])

// Update participant styles above when updating color styles
export const ColorStyles:Map<String,ColorStyle> = new Map([

    ["red", {
        text: "text-red-600",
        textDark: "text-red-800",
        border: "border-red-600",
        borderDark: "border-red-800",
        bg: "bg-red-700",
        bgLight: "bg-red-300",
        bgDark: "bg-red-900",
        bgHover: "hover:bg-red-600",
        bgDarkHover: "hover:bg-red-800",
    }],
    ["orange", {
        text: "text-orange-600",
        textDark: "text-orange-800",
        border: "border-orange-600",
        borderDark: "border-orange-800",
        bg: "bg-orange-600",
        bgLight: "bg-orange-300",
        bgDark: "bg-orange-800",
        bgHover: "hover:bg-orange-600",
        bgDarkHover: "hover:bg-orange-800",
    }],
    ["amber", {
        text: "text-amber-600",
        textDark: "text-amber-800",
        border: "border-amber-600",
        borderDark: "border-amber-800",
        bg: "bg-amber-600",
        bgLight: "bg-amber-300",
        bgDark: "bg-amber-800",
        bgHover: "hover:bg-amber-600",
        bgDarkHover: "hover:bg-amber-800",
    }],
    ["emerald", {
        text: "text-emerald-600",
        textDark: "text-emerald-800",
        border: "border-emerald-600",
        borderDark: "border-emerald-800",
        bg: "bg-emerald-600",
        bgLight: "bg-emerald-300",
        bgDark: "bg-emerald-800",
        bgHover: "hover:bg-emerald-600",
        bgDarkHover: "hover:bg-emerald-800",
    }],
    ["sky", {
        text: "text-sky-600",
        textDark: "text-sky-800",
        border: "border-sky-600",
        borderDark: "border-sky-800",
        bg: "bg-sky-600",
        bgLight: "bg-sky-300",
        bgDark: "bg-sky-800",
        bgHover: "hover:bg-sky-600",
        bgDarkHover: "hover:bg-sky-800",
    }],
    ["purple", {
        text: "text-purple-600",
        textDark: "text-purple-800",
        border: "border-purple-600",
        borderDark: "border-purple-800",
        bg: "bg-purple-600",
        bgLight: "bg-purple-300",
        bgDark: "bg-purple-800",
        bgHover: "hover:bg-purple-600",
        bgDarkHover: "hover:bg-purple-800",
    }],
    ["pink", {
        text: "text-pink-600",
        textDark: "text-pink-800",
        border: "border-pink-600",
        borderDark: "border-pink-800",
        bg: "bg-pink-600",
        bgLight: "bg-pink-300",
        bgDark: "bg-pink-800",
        bgHover: "hover:bg-pink-600",
        bgDarkHover: "hover:bg-pink-800",
    }],
    ["mauve", {
        text: "text-mauve-400",
        textDark: "text-mauve-600",
        border: "border-mauve-600",
        borderDark: "border-mauve-800",
        bg: "bg-mauve-600",
        bgLight: "bg-mauve-300",
        bgDark: "bg-mauve-800",
        bgHover: "hover:bg-mauve-600",
        bgDarkHover: "hover:bg-mauve-800",
    }],
])

export function getColorByIconName(icon:string):string {
    switch ( icon ) {
        // Participant states
        case "clock":
            return "purple"
        case "pin":
            return "sky"
        case "check-badge":
            return "emerald"
        case "question-circle":
        case "triangle-bang":
            return "red"
        case "x":
            return "mauve"
        case "hourglass":
        case "arrow-box":
            return "orange"
        
        // others
        case "tag":
            return "orange"
        case "group":
            return "emerald"
        case "medal":
            return "purple"
        case "pencil":
            return "sky"
        case "search":
            return "pink"
        
        default:
            return "black"
    }
}