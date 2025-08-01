"use client"

import {JSX} from "react"
import {useState} from "react";
import {ChangeEvent} from "react";

export default function TestPlayVideoSegmented(): JSX.Element {

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        setSelectedFile(event.target.files![0]);
    };

    return (
        <div className={"p-5 flex flex-col items-center justify-center"}>
            <input type="file" onChange={onFileChange} multiple={false} className={"my-3"}/>

            {selectedFile && displayFileInfo(selectedFile)}

            <video id={"my-video"} className={"border-4 border-red-700 mx-auto my-3"} controls autoPlay/>
        </div>
    )

}

function displayFileInfo(selectedFile: File): JSX.Element {
    return (
        <table>
            <tbody>
                <tr>
                    <td className={"border border-gray-200 text-left p-2"}>file name:</td>
                    <td className={"border border-gray-200 text-right p-2 font-bold"}>{selectedFile.name}</td>
                </tr>
                <tr>
                    <td className={"border border-gray-200 text-left p-2"}>file type:</td>
                    <td className={"border border-gray-200 text-right p-2 font-bold"}>{selectedFile.type}</td>
                </tr>
                <tr>
                    <td className={"border border-gray-200 text-left p-2"}>file size (bytes):</td>
                    <td className={"border border-gray-200 text-right p-2 font-bold"}>{selectedFile.size}</td>
                </tr>
                <tr>
                    <td className={"border border-gray-200 text-left p-2"}>last modified:</td>
                    <td className={"border border-gray-200 text-right p-2 font-bold"}>{new Date(selectedFile.lastModified).toISOString()}</td>
                </tr>
            </tbody>
        </table>
    )
}