"use client"

import {JSX} from "react"
import {useState} from "react";
import {ChangeEvent} from "react";
import {MP4BoxBuffer} from "mp4box";
import * as MP4Box from "mp4box"

MP4Box.Log.setLogLevel(MP4Box.Log.info)

export default function TestPlayVideoSegmented(): JSX.Element {

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        setSelectedFile(event.target.files![0]);
    };

    const [mp4boxLoadingProgress, setMp4boxLoadingProgress] = useState<number>(0);
    const [mp4boxBytesRead, setMp4boxBytesRead] = useState<number>(0);
    const [mp4BoxFileInfo, setMp4BoxFileInfo] = useState<MP4Box.Movie | null>(null);

    const mp4BoxFile: MP4Box.ISOFile = createMp4BoxFile(setMp4BoxFileInfo);

    const bytesToProgress = (bytesRead: number) => {
        setMp4boxBytesRead(bytesRead);
        setMp4boxLoadingProgress((bytesRead / selectedFile.size) * 100)
    };

    return (
        <div className={"p-5 flex flex-col items-center justify-center"}>
            <input type="file" onChange={onFileChange} multiple={false} className={"my-3"}/>

            {selectedFile && displayFileInfo(selectedFile)}

            {selectedFile &&
                <div>
                    <button type={"button"} onClick={() => onReadFile(selectedFile, mp4BoxFile, bytesToProgress)}
                            className="mt-10 text-white bg-green-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800"
                    >Read file {selectedFile.name}
                    </button>

                    <div>MP4Box bytes read: {mp4boxBytesRead}</div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                        <div className="bg-blue-400 h-2.5 rounded-full"
                             style={{"width": mp4boxLoadingProgress + "%"}}></div>
                    </div>

                    {mp4BoxFileInfo && mp4BoxFileInfo && displayMp4BoxFileInfo(mp4BoxFileInfo)}
                </div>
            }

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

function displayMp4BoxFileInfo(info: MP4Box.Movie) {

    const tracksInfo = info.tracks.map((track: MP4Box.Track): JSX.Element => {
        return (
            <tr key={"track." + track.id}>
                <td key={"track." + track.id + ".id"} className={"border border-gray-200 text-right p-2"}>{track.id}</td>
                <td key={"track." + track.id + ".type"} className={"border border-gray-200 text-right p-2"}>{track.type}</td>
                <td key={"track." + track.id + ".size"} className={"border border-gray-200 text-right p-2"}>{track.size}</td>
                <td key={"track." + track.id + ".codec"} className={"border border-gray-200 text-right p-2"}>{track.codec}</td>
            </tr>
        )
    })

    return (
        <div>
            <table className={"mt-5"}>
                <tbody>
                <tr>
                    <td className={"border border-gray-200 text-left p-2"}>MIME:</td>
                    <td className={"border border-gray-200 text-right p-2 font-bold"}>{info.mime}</td>
                </tr>
                <tr>
                    <td className={"border border-gray-200 text-left p-2"}>Duration:</td>
                    <td className={"border border-gray-200 text-right p-2 font-bold"}>{info.duration}</td>
                </tr>
                <tr>
                    <td className={"border border-gray-200 text-left p-2"}>Timescale:</td>
                    <td className={"border border-gray-200 text-right p-2 font-bold"}>{info.timescale}</td>
                </tr>
                </tbody>
            </table>
            <h3 className={"p-3 text-xl text-center"}>tracks info</h3>
            <table className={"w-full"}>
                <thead>
                <tr>
                    <th className={"border border-gray-200"}>id</th>
                    <th className={"border border-gray-200"}>type</th>
                    <th className={"border border-gray-200"}>size</th>
                    <th className={"border border-gray-200"}>codec</th>
                </tr>
                </thead>
                <tbody>
                {tracksInfo}
                </tbody>
            </table>
        </div>
    )

}

function onReadFile(selectedFile: File,
                    mp4BoxFile: MP4Box.ISOFile<unknown, unknown>,
                    bytesToProgress: (p: number) => void): void {

    selectedFile.stream().pipeTo(readStreamIntoMp4IsoFile(mp4BoxFile, bytesToProgress));

}

function createMp4BoxFile(setMp4BoxFileInfo: (info: MP4Box.Movie) => void): MP4Box.ISOFile<unknown, unknown> {
    const mp4BoxFile: MP4Box.ISOFile<unknown, unknown> = MP4Box.createFile(true);

    mp4BoxFile.onError = (m: string, msg: string) => {
        console.error(msg);
    };

    mp4BoxFile.onReady = (info: MP4Box.Movie) => {
        console.info(info);
        setMp4BoxFileInfo(info)
    };

    return mp4BoxFile;
}


function readStreamIntoMp4IsoFile(mp4boxFile: MP4Box.ISOFile<unknown, unknown>,
                                  setMp4boxLodingProgress: (p: number) => void): WritableStream<Uint8Array<ArrayBufferLike>> {

    var nextBufferStart = 0;

    function typedArrayToBuffer(array: Uint8Array): ArrayBuffer {
        return array.buffer.slice(array.byteOffset, array.byteLength + array.byteOffset) as ArrayBuffer
    }


    return new WritableStream<Uint8Array<ArrayBufferLike>>({

            start: async (controller: WritableStreamDefaultController): Promise<void> => {
                console.log("readStreamIntoMp4IsoFile.start")
            },
            write: async (chunk: Uint8Array<ArrayBufferLike>, controller: WritableStreamDefaultController): Promise<void> => {
                const ab: MP4BoxBuffer = MP4BoxBuffer.fromArrayBuffer(typedArrayToBuffer(chunk), nextBufferStart)
                nextBufferStart += chunk.length
                mp4boxFile.appendBuffer(ab, false);
                setMp4boxLodingProgress(nextBufferStart)
            },
            close: async (): Promise<void> =>  {
                console.log("readStreamIntoMp4IsoFile.close")
                mp4boxFile.flush();
                setMp4boxLodingProgress(nextBufferStart)
            },
            abort: async (reason: any): Promise<void> => {
                console.log("readStreamIntoMp4IsoFile.abort" + reason)
            },
        },
        {
            highWaterMark: 3,
            size: () => 1,
        },
    );
}
