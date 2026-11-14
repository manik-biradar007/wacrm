// Template configuration for biodata preview
export interface TemplatePadding {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

export interface TemplatePhotoBorder {
    width: number;
    color: string;
    radius: number;
}

export interface TemplatePhotoPos {
    x: number;
    y: number;
}

export interface Template {
    id: string;
    label: string;
    bgImage: string;
    previewImage: string;
    padding: TemplatePadding;
    headerBottomSpacing: number;
    titleColor: string;
    sectionColor: string;
    labelColor: string;
    valueColor: string;
    photoWidth: number;
    photoPos: TemplatePhotoPos;
    photoBorder: TemplatePhotoBorder;
    /** Fallback page colour, drawn under the background image. */
    bg?: string;
    /** Horizontal nudge of the centred header, in design px. */
    headerOffsetX?: number;
}

export interface Templates {
    [key: string]: Template;
}

export const templates: Templates = {
    "fancy_04": {
        "id": "fancy_04",
        "label": "Amber",
        "bgImage": "/images/templates/fancy_04.jpg",
        "previewImage": "/images/templates/preview/fancy-4-en-template.webp",
        "padding": {
            "top": 42,
            "right": 60,
            "bottom": 50,
            "left": 82
        },
        "headerBottomSpacing": 2,
        "titleColor": "#9c3d18",
        "sectionColor": "#9c3d18",
        "labelColor": "#6d2408",
        "valueColor": "#000000",
        "photoWidth": 180,
        "photoPos": {
            "x": 0,
            "y": 0
        },
        "photoBorder": {
            "width": 2,
            "color": "#9c3d18",
            "radius": 4
        }
    },
    "fancy_01": {
        "id": "fancy_01",
        "label": "Marigold",
        "bgImage": "/images/templates/fancy_01.jpg",
        "previewImage": "/images/templates/preview/fancy-1-en-template.webp",
        "padding": {
            "top": 25,
            "right": 75,
            "bottom": 60,
            "left": 95
        },
        "headerBottomSpacing": 2,
        "titleColor": "#9e0200",
        "sectionColor": "#9e0200",
        "labelColor": "#6b0000",
        "valueColor": "#000000",
        "photoWidth": 180,
        "photoPos": {
            "x": 0,
            "y": 0
        },
        "photoBorder": {
            "width": 2,
            "color": "#9e0200",
            "radius": 4
        }
    },
    "fancy_02": {
        "id": "fancy_02",
        "label": "Magenta",
        "bgImage": "/images/templates/fancy_02.jpg",
        "previewImage": "/images/templates/preview/fancy-2-en-template.webp",
        "padding": {
            "top": 30,
            "right": 65,
            "bottom": 50,
            "left": 80
        },
        "headerBottomSpacing": 2,
        "titleColor": "#f7d370",
        "sectionColor": "#f7d370",
        "labelColor": "#d4a836",
        "valueColor": "#ffffff",
        "photoWidth": 180,
        "photoPos": {
            "x": 0,
            "y": 0
        },
        "photoBorder": {
            "width": 2,
            "color": "#f7d370",
            "radius": 4
        }
    },
    "fancy_03": {
        "id": "fancy_03",
        "label": "Royal Arch",
        "bgImage": "/images/templates/fancy_03.jpg",
        "previewImage": "/images/templates/preview/fancy-3-en-template.webp",
        "padding": {
            "top": 2,
            "right": 65,
            "bottom": 55,
            "left": 75
        },
        "headerBottomSpacing": 3.5,
        "titleColor": "#fffa75",
        "sectionColor": "#b6142a",
        "labelColor": "#7a0a1a",
        "valueColor": "#000000",
        "photoWidth": 180,
        "photoPos": {
            "x": 0,
            "y": 0
        },
        "photoBorder": {
            "width": 2,
            "color": "#b6142a",
            "radius": 4
        }
    },
    
    "fancy_05": {
        "id": "fancy_05",
        "label": "Crimson",
        "bgImage": "/images/templates/fancy_05.jpg",
        "previewImage": "/images/templates/preview/fancy-5-en-template.webp",
        "padding": {
            "top": 15,
            "right": 65,
            "bottom": 50,
            "left": 80
        },
        "headerBottomSpacing": 2,
        "titleColor": "#7b1113",
        "sectionColor": "#7b1113",
        "labelColor": "#540608",
        "valueColor": "#000000",
        "photoWidth": 180,
        "photoPos": {
            "x": 0,
            "y": 0
        },
        "photoBorder": {
            "width": 2,
            "color": "#7b1113",
            "radius": 4
        }
    },
    "fancy_06": {
        "id": "fancy_06",
        "label": "Royal Blue",
        "bgImage": "/images/templates/fancy_06.jpg",
        "previewImage": "/images/templates/preview/fancy-6-en-template.webp",
        "padding": {
            "top": 5,
            "right": 65,
            "bottom": 55,
            "left": 80
        },
        "headerBottomSpacing": 2,
        "titleColor": "#003882",
        "sectionColor": "#003882",
        "labelColor": "#002157",
        "valueColor": "#000000",
        "photoWidth": 180,
        "photoPos": {
            "x": 0,
            "y": 0
        },
        "photoBorder": {
            "width": 2,
            "color": "#003882",
            "radius": 4
        }
    },
    "fancy_07": {
        "id": "fancy_07",
        "label": "Emerald",
        "bgImage": "/images/templates/fancy_07.jpg",
        "previewImage": "/images/templates/preview/fancy-7-en-template.webp",
        "padding": {
            "top": 35,
            "right": 65,
            "bottom": 50,
            "left": 82
        },
        "headerBottomSpacing": 2,
        "titleColor": "#2e571e",
        "sectionColor": "#2e571e",
        "labelColor": "#19380e",
        "valueColor": "#000000",
        "photoWidth": 180,
        "photoPos": {
            "x": 0,
            "y": 0
        },
        "photoBorder": {
            "width": 2,
            "color": "#2e571e",
            "radius": 4
        }
    },
    ab_01: {
        id: "ab_01",
        label: "Abstract Orange",
        bgImage: "/images/templates/ab_01.jpg",
        previewImage: "/images/templates/preview/abstract-orange-en-template.webp",
        padding: {
            top: 0,
            right: 80,
            bottom: 70,
            left: 100,
        },
        headerBottomSpacing: 2,
        titleColor: "#d3601a",
        sectionColor: "#d3601a",
        labelColor: "#000000",
        valueColor: "#000000",
        photoWidth: 180,
        photoPos: {
            x: 0,
            y: 0,
        },
        photoBorder: {
            width: 2,
            color: "#d3601a",
            radius: 4,
        },
    },
    "red_velvet": {
        "id": "red_velvet",
        "label": "Red Velvet",
        previewImage: "/images/templates/preview/abstract-red-velvet-marathi-template.webp",
        "bgImage": "/images/templates/trad_09.jpg",
        "padding": {
            "top": 30,
            "right": 60,
            "bottom": 40,
            "left": 100
        },
        "headerBottomSpacing": 2,
        "titleColor": "#ad1718",
        "sectionColor": "#ad1718",
        "labelColor": "#000000",
        "valueColor": "#000000",
        "photoWidth": 180,
        "photoPos": {
            "x": 0,
            "y": 0
        },
        "photoBorder": {
            "width": 2,
            "color": "#ad1718",
            "radius": 4
        }
    },
    "abstract_frame": {
        "id": "abstract_frame",
        "label": "Abstract Frame",
        previewImage: "/images/templates/preview/abstract_frame-en-template.webp",
        "bgImage": "/images/templates/ab_14.jpg",
        "padding": {
            "top": 40,
            "right": 50,
            "bottom": 60,
            "left": 80
        },
        "headerBottomSpacing": 2,
        "titleColor": "#7f230f",
        "sectionColor": "#7f230f",
        "labelColor": "#000000",
        "valueColor": "#000000",
        "photoWidth": 180,
        "photoPos": {
            "x": 0,
            "y": 0
        },
        "photoBorder": {
            "width": 2,
            "color": "#7f230f",
            "radius": 4
        }
    },
    ab_02: {
        id: "ab_02",
        label: "Abstract Yellow",
        bgImage: "/images/templates/ab_02.jpg",
        previewImage: "/images/templates/preview/abstract-yellow-en-template.webp",
        padding: {
            top: 30,
            right: 50,
            bottom: 40,
            left: 80,
        },
        headerBottomSpacing: 2,
        titleColor: "#9f4913",
        sectionColor: "#9f4913",
        labelColor: "#000000",
        valueColor: "#000000",
        photoWidth: 180,
        photoPos: {
            x: 0,
            y: 0,
        },
        photoBorder: {
            width: 2,
            color: "#9f4913",
            radius: 4,
        },
    },
    // free: {
    //     id: "free",
    //     label: "Free",
    //     bgImage: "/images/templates/free.jpg",
    //     previewImage: "/images/templates/preview/free.webp",
    //     padding: {
    //         top: 30,
    //         right: 20,
    //         bottom: 20,
    //         left: 80,
    //     },
    //     godLayout: "inline",
    //     headerBottomSpacing:2,
    //     titleFont: "bold 25px 'Google Sans', sans-serif",
    //     titleColor: "#000000",
    //     sectionFont: "bold 25px 'Google Sans', sans-serif",
    //     sectionColor: "#000000",
    //     fieldFont: "18px 'Google Sans', sans-serif",
    //     labelColor: "#000000",
    //     valueColor: "#000000",
    //     photoWidth: 0,
    //     photoPos: {
    //         x: 570,
    //         y: 190,
    //     },
    //     photoBorder: {
    //         width: 2,
    //         color: "#000000",
    //         radius: 4,
    //     },
    // },
    ab_03: {
        id: "ab_03",
        label: "Abstract Wood",
        bgImage: "/images/templates/ab_03.jpg",
        previewImage: "/images/templates/preview/abstract-wood-en-template.webp",
        padding: {
            top: 10,
            right: 50,
            bottom: 50,
            left: 83,
        },
        headerBottomSpacing: 2,
        titleColor: "#973d27",
        sectionColor: "#973d27",
        labelColor: "#000000",
        valueColor: "#000000",
        photoWidth: 180,
        photoPos: {
            x: 0,
            y: 0,
        },
        photoBorder: {
            width: 2,
            color: "#d3601a",
            radius: 4,
        },
    },
    ab_04: {
        id: "ab_04",
        label: "Abstract Shaded",
        bgImage: "/images/templates/ab_04.jpg",
        previewImage: "/images/templates/preview/abstract-shaded-en-template.webp",
        padding: {
            top: 10,
            right: 70,
            bottom: 80,
            left: 100,
        },
        headerBottomSpacing: 2,
        titleColor: "#302f75",
        sectionColor: "#302f75",
        labelColor: "#000000",
        valueColor: "#000000",
        photoWidth: 180,
        photoPos: {
            x: 0,
            y: 0,
        },
        photoBorder: {
            width: 2,
            color: "#302f75",
            radius: 4,
        },
    },
    ab_05: {
        id: "ab_05",
        label: "Abstract Flames",
        bgImage: "/images/templates/ab_05.jpg",
        previewImage: "/images/templates/preview/abstract-flames-en-template.webp",
        padding: {
            top: 30,
            right: 40,
            bottom: 30,
            left: 60,
        },
        headerBottomSpacing: 2,
        titleColor: "#9e0200",
        sectionColor: "#9e0200",
        labelColor: "#000000",
        valueColor: "#000000",
        photoWidth: 180,
        photoPos: {
            x: 0,
            y: 0,
        },
        photoBorder: {
            width: 2,
            color: "#9e0200",
            radius: 4,
        },
    },
    ab_06: {
        id: "ab_06",
        label: "Abstract Flower",
        bgImage: "/images/templates/ab_06.jpg",
        previewImage: "/images/templates/preview/abstract-flower-en-template.webp",
        padding: {
            top: 10,
            right: 60,
            bottom: 100,
            left: 80,
        },
        headerBottomSpacing: 2,
        titleColor: "#d51005",
        sectionColor: "#d51005",
        labelColor: "#000000",
        valueColor: "#000000",
        photoWidth: 180,
        photoPos: {
            x: 0,
            y: 0,
        },
        photoBorder: {
            width: 2,
            color: "#d51005",
            radius: 4,
        },
    },
    "blue_velvet": {
        "id": "blue_velvet",
        "label": "Blue Velvet",
        previewImage: "/images/templates/preview/blue-velvet-en-template.webp",
        "bgImage": "/images/templates/trad_10.jpg",
        "padding": {
            "top": 50,
            "right": 20,
            "bottom": 60,
            "left": 70
        },
        "headerBottomSpacing": 2,
        "titleColor": "#fffa75",
        "sectionColor": "#fffa75",
        "labelColor": "#fff",
        "valueColor": "#fff",
        "photoWidth": 180,
        "photoPos": {
            "x": 0,
            "y": 0
        },
        "photoBorder": {
            "width": 2,
            "color": "#fffa75",
            "radius": 4
        }
    },
    ab_07: {
        id: "ab_07",
        label: "Abstract Red",
        bgImage: "/images/templates/ab_07.jpg",
        previewImage: "/images/templates/preview/abstract-red-en-template.webp",
        padding: {
            top: 25,
            right: 80,
            bottom: 90,
            left: 100,
        },
        headerBottomSpacing: 2,
        titleColor: "#d51005",
        sectionColor: "#d51005",
        labelColor: "#000000",
        valueColor: "#000000",
        photoWidth: 180,
        photoPos: {
            x: 0,
            y: 0,
        },
        photoBorder: {
            width: 2,
            color: "#d51005",
            radius: 4,
        },
    },
    ab_08: {
        id: "ab_08",
        label: "Abstract Temple",
        bgImage: "/images/templates/ab_08.jpg",
        previewImage: "/images/templates/preview/abstract-temple-en-template.webp",
        padding: {
            top: 30,
            right: 80,
            bottom: 30,
            left: 100,
        },
        headerBottomSpacing: 2,
        titleColor: "#772712",
        sectionColor: "#772712",
        labelColor: "#000000",
        valueColor: "#000000",
        photoWidth: 180,
        photoPos: {
            x: 0,
            y: 0,
        },
        photoBorder: {
            width: 2,
            color: "#772712",
            radius: 4,
        },
    },
    ab_09: {
        id: "ab_09",
        label: "Abstract Ganesha",
        bgImage: "/images/templates/ab_09.jpg",
        previewImage: "/images/templates/preview/abstract-ganesha-en-template.webp",
        padding: {
            top: 14,
            right: 30,
            bottom: 40,
            left: 70,
        },
        headerBottomSpacing: 2,
        titleColor: "#772712",
        sectionColor: "#772712",
        labelColor: "#000000",
        valueColor: "#000000",
        photoWidth: 180,
        photoPos: {
            x: 0,
            y: 0,
        },
        photoBorder: {
            width: 2,
            color: "#772712",
            radius: 4,
        },
    },
    ab_10: {
        id: "ab_10",
        label: "Abstract Lotus",
        bgImage: "/images/templates/ab_10.jpg",
        previewImage: "/images/templates/preview/abstract-lotus-en-template.webp",
        padding: {
            top: 15,
            right: 30,
            bottom: 80,
            left: 70,
        },
        headerBottomSpacing: 2,
        titleColor: "#b6142a",
        sectionColor: "#b6142a",
        labelColor: "#000000",
        valueColor: "#000000",
        photoWidth: 180,
        photoPos: {
            x: 0,
            y: 0,
        },
        photoBorder: {
            width: 2,
            color: "#b6142a",
            radius: 4,
        },
    },
    ab_11: {
        id: "ab_11",
        label: "Abstract Rose",
        bgImage: "/images/templates/ab_11.jpg",
        previewImage: "/images/templates/preview/abstract-rose-en-template.webp",
        padding: {
            top: 80,
            right: 85,
            bottom: 52,
            left: 110,
        },
        headerBottomSpacing: 3.5,
        titleColor: "#f7d370",
        sectionColor: "#f7d370",
        labelColor: "#ffffff",
        valueColor: "#ffffff",
        photoWidth: 180,
        photoPos: {
            x: 0,
            y: 0,
        },
        photoBorder: {
            width: 2,
            color: "#f7d370",
            radius: 4,
        },
    },
    ab_12: {
        id: "ab_12",
        label: "Abstract Blue",
        bgImage: "/images/templates/ab_12.jpg",
        previewImage: "/images/templates/preview/abstract-blue-en-template.webp",
        padding: {
            top: 40,
            right: 30,
            bottom: 50,
            left: 70,
        },
        headerBottomSpacing: 2,
        titleColor: "#fffa75",
        sectionColor: "#fffa75",
        labelColor: "#ffffff",
        valueColor: "#ffffff",
        photoWidth: 180,
        photoPos: {
            x: 0,
            y: 0,
        },
        photoBorder: {
            width: 2,
            color: "#fffa75",
            radius: 4,
        },
    },
    ab_13: {
        id: "ab_13",
        label: "Abstract Open",
        bgImage: "/images/templates/ab_13.jpg",
        previewImage: "/images/templates/preview/abstract-open-en-template.webp",
        padding: {
            top: 130,
            right: 85,
            bottom: 40,
            left: 110,
        },
        headerBottomSpacing: 2,
        titleColor: "#af1f2e",
        sectionColor: "#af1f2e",
        labelColor: "#000000",
        valueColor: "#000000",
        photoWidth: 180,
        photoPos: {
            x: 0,
            y: 0,
        },
        photoBorder: {
            width: 2,
            color: "#af1f2e",
            radius: 4,
        },
    },
    "green_01": {
        "id": "green_01",
        "label": "Green 1",
        "bgImage": "/images/templates/green_01.jpg",
        previewImage: "/images/templates/preview/green-1-en-template.webp",
        "padding": {
            "top": 10,
            "right": 20,
            "bottom": 10,
            "left": 80
        },
        "headerBottomSpacing": 2,
        "titleColor": "#3e7e20",
        "sectionColor": "#3e7e20",
        "labelColor": "#000000",
        "valueColor": "#000000",
        "photoWidth": 180,
        "photoPos": {
            "x": 0,
            "y": 0
        },
        "photoBorder": {
            "width": 2,
            "color": "#3e7e20",
            "radius": 4
        }
    },
    "green_02": {
        "id": "green_02",
        "label": "Green 2",
        "bgImage": "/images/templates/green_02.jpg",
        previewImage: "/images/templates/preview/green-2-en-template.webp",
        "padding": {
            "top": 152,
            "right": 20,
            "bottom": 100,
            "left": 60
        },
        "headerBottomSpacing": 2,
        "titleColor": "#ffc400",
        "sectionColor": "#ffc400",
        "labelColor": "#ffffff",
        "valueColor": "#ffffff",
        "photoWidth": 180,
        "photoPos": {
            "x": 0,
            "y": 0
        },
        "photoBorder": {
            "width": 2,
            "color": "#ffc800",
            "radius": 4
        }
    },
    "green_03": {
        "id": "green_03",
        "label": "Green 3",
        "bgImage": "/images/templates/green_03.jpg",
        previewImage: "/images/templates/preview/green-3-en-template.webp",
        "padding": {
            "top": 10,
            "right": 40,
            "bottom": 10,
            "left": 80
        },
        "headerBottomSpacing": 2,
        "titleColor": "#ffc400",
        "sectionColor": "#ffc400",
        "labelColor": "#ffffff",
        "valueColor": "#ffffff",
        "photoWidth": 180,
        "photoPos": {
            "x": 0,
            "y": 0
        },
        "photoBorder": {
            "width": 2,
            "color": "#ffc800",
            "radius": 4
        }
    },
    "classic_01": {
        "id": "classic_01",
        "label": "Classic 1",
        "bgImage": "/images/templates/trad_01.jpg",
        previewImage: "/images/templates/preview/classic-1-en-template.webp",
        "padding": {
            "top": 33,
            "right": 25,
            "bottom": 30,
            "left": 80
        },
        "headerBottomSpacing": 2,
        "titleColor": "#5f2825",
        "sectionColor": "#5f2825",
        "labelColor": "#000000",
        "valueColor": "#000000",
        "photoWidth": 180,
        "photoPos": {
            "x": 0,
            "y": 0
        },
        "photoBorder": {
            "width": 2,
            "color": "#5f2825",
            "radius": 4
        }
    },
    "classic_02": {
        "id": "classic_02",
        "label": "Classic 2",
        "bgImage": "/images/templates/trad_02.jpg",
        previewImage: "/images/templates/preview/classic-2-en-template.webp",
        "padding": {
            "top": 30,
            "right": 20,
            "bottom": 60,
            "left": 61
        },
        "headerBottomSpacing": 2,
        "titleColor": "#954b0a",
        "sectionColor": "#954b0a",
        "labelColor": "#000000",
        "valueColor": "#000000",
        "photoWidth": 180,
        "photoPos": {
            "x": 0,
            "y": 0
        },
        "photoBorder": {
            "width": 2,
            "color": "#954b0a",
            "radius": 4
        }
    },
    "classic_03": {
        "id": "classic_03",
        "label": "Classic 3",
        "bgImage": "/images/templates/trad_03.jpg",
        previewImage: "/images/templates/preview/classic-3-en-template.webp",
        "padding": {
            "top": 40,
            "right": 50,
            "bottom": 60,
            "left": 80
        },
        "headerBottomSpacing": 2,
        "titleColor": "#954b0a",
        "sectionColor": "#954b0a",
        "labelColor": "#000000",
        "valueColor": "#000000",
        "photoWidth": 180,
        "photoPos": {
            "x": 0,
            "y": 0
        },
        "photoBorder": {
            "width": 2,
            "color": "#954b0a",
            "radius": 4
        }
    },
    "classic_04": {
        "id": "classic_04",
        "label": "Classic 4",
        "bgImage": "/images/templates/trad_04.jpg",
        previewImage: "/images/templates/preview/classic-4-en-template.webp",
        "padding": {
            "top": 33,
            "right": 25,
            "bottom": 30,
            "left": 80
        },
        "headerBottomSpacing": 2,
        "titleColor": "#a84c00",
        "sectionColor": "#a84c00",
        "labelColor": "#000000",
        "valueColor": "#000000",
        "photoWidth": 180,
        "photoPos": {
            "x": 0,
            "y": 0
        },
        "photoBorder": {
            "width": 2,
            "color": "#a84c00",
            "radius": 4
        }
    },
    "classic_05": {
        "id": "classic_05",
        "label": "Classic 5",
        "bgImage": "/images/templates/trad_05.jpg",
        previewImage: "/images/templates/preview/classic-5-en-template.webp",
        "padding": {
            "top": 98,
            "right": 15,
            "bottom": 90,
            "left": 50
        },
        "headerBottomSpacing": 2,
        "titleColor": "#6e0432",
        "sectionColor": "#6e0432",
        "labelColor": "#000000",
        "valueColor": "#000000",
        "photoWidth": 180,
        "photoPos": {
            "x": 0,
            "y": 0
        },
        "photoBorder": {
            "width": 2,
            "color": "#6e0432",
            "radius": 4
        }
    },
    "classic_06": {
        "id": "classic_06",
        "label": "Classic 6",
        "bgImage": "/images/templates/trad_06.jpg",
        previewImage: "/images/templates/preview/classic-6-en-template.webp",
        "padding": {
            "top": 33,
            "right": 30,
            "bottom": 30,
            "left": 90
        },
        "headerBottomSpacing": 2,
        "titleColor": "#cc9600",
        "sectionColor": "#cc9600",
        "labelColor": "#000000",
        "valueColor": "#000000",
        "photoWidth": 180,
        "photoPos": {
            "x": 0,
            "y": 0
        },
        "photoBorder": {
            "width": 2,
            "color": "#cc9600",
            "radius": 4
        }
    },
    "classic_07": {
        "id": "classic_07",
        "label": "Classic 7",
        "bgImage": "/images/templates/trad_07.jpg",
        previewImage: "/images/templates/preview/classic-7-en-template.webp",
        "padding": {
            "top": 10,
            "right": 25,
            "bottom": 30,
            "left": 90
        },
        "headerBottomSpacing": 2,
        "titleColor": "#daaa32",
        "sectionColor": "#daaa32",
        "labelColor": "#000000",
        "valueColor": "#000000",
        "photoWidth": 180,
        "photoPos": {
            "x": 0,
            "y": 0
        },
        "photoBorder": {
            "width": 2,
            "color": "#daaa32",
            "radius": 4
        }
    },
    "classic_08": {
        "id": "classic_08",
        "label": "Classic 8",
        "bgImage": "/images/templates/trad_08.jpg",
        previewImage: "/images/templates/preview/classic-8-en-template.webp",
        "padding": {
            "top": 33,
            "right": 40,
            "bottom": 60,
            "left": 90
        },
        "headerBottomSpacing": 2,
        "titleColor": "#954b0a",
        "sectionColor": "#954b0a",
        "labelColor": "#000000",
        "valueColor": "#000000",
        "photoWidth": 180,
        "photoPos": {
            "x": 0,
            "y": 0
        },
        "photoBorder": {
            "width": 2,
            "color": "#954b0a",
            "radius": 4
        }
    }    
};

// Helper to get the first template key dynamically
export const DEFAULT_TEMPLATE_KEY = Object.keys(templates)[0];

// Helper to get the default template ID
export const getDefaultTemplateId = (): string => templates[DEFAULT_TEMPLATE_KEY].id;

// Get template by ID
export const getTemplateById = (id: string): Template | undefined => {
    return Object.values(templates).find(t => t.id === id);
};

// Get template key by ID
export const getTemplateKeyById = (id: string): string | undefined => {
    for (const [key, template] of Object.entries(templates)) {
        if (template.id === id) {
            return key;
        }
    }
    return undefined;
};
