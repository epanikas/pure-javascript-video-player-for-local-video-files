import type {Config} from "tailwindcss";
import * as typo from '@tailwindcss/typography';


const config: Config = {
    content: [
        "./src/**/*.ts",
        "./src/**/*.tsx",
        "./src/**/*.js",
        "./src/**/*.jsx",
        "./public/**/*.html",
        "./src/**/*.{html,js}",
        "./public/site/**/*.yaml",
    ],

    // theme: {
    //     extend: {
    //         typography: {
    //             DEFAULT: {
    //                 css: {
    //                     maxWidth: 'unset', // add required value here
    //                 }
    //             }
    //         }
    //     },
    // },
    plugins: [
        typo.default(),
    ],
};

export default config;
