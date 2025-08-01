import "./globals.css";
import React from "react";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {

    return (
        <html lang={"en"} dir={"ltr"}>
        <body className={"bg-white dark:bg-black text-black dark:text-white"} >
        {children}
        </body>
        </html>
    );
}

