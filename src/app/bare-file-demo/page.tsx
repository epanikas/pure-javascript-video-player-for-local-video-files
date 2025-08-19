"use client"

import {JSX, useRef} from "react"
import {useState} from "react";
import {ChangeEvent} from "react";
import {MutableRefObject} from "react";
import {MP4BoxBuffer} from "mp4box-forked";
import * as MP4Box from "mp4box-forked"


MP4Box.Log.setLogLevel(MP4Box.Log.info)

const supportedTrackTypes = ['audio', 'video']
let isInfoLoaded = false;

export default function TestPlayVideoSegmented(): JSX.Element {

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        setSelectedFile(event.target.files![0]);
    };

    const [mp4boxLoadingProgress, setMp4boxLoadingProgress] = useState<number>(0);
    const [mp4boxBytesRead, setMp4boxBytesRead] = useState<number>(0);
    const [mp4BoxFileInfo, setMp4BoxFileInfo] = useState<MP4Box.Movie | null>(null);

    let myMediaSource: MediaSource;
    const videoSourceBuffer: MutableRefObject<SourceBuffer | null> = useRef(null);

    var nextBufferStart = 0;
    const BUFFER_SIZE_BYTES = 32768;

    async function readNextChunk() {
        console.log("readNextChunk: reading", nextBufferStart)
        const chunk = await selectedFile!.slice(nextBufferStart, nextBufferStart + BUFFER_SIZE_BYTES).arrayBuffer();
        if (chunk && chunk.byteLength > 0) {
            console.log("received chunk of size ", chunk.byteLength, videoSourceBuffer, myMediaSource.readyState)
            videoSourceBuffer.current?.appendBuffer(chunk)
            nextBufferStart += chunk.byteLength
        } else {
            console.log("reading file finished", myMediaSource.readyState)
            if (myMediaSource.readyState === 'open') {
                myMediaSource.endOfStream()
                console.log("media stream status", myMediaSource.readyState)
            }
        }
    }

    function onFileInfoReadyCb(info: MP4Box.Movie): void {
        setMp4BoxFileInfo(info)
        isInfoLoaded = true;

        let codecs: string[] = [];
        for (let i = 0; i < info.tracks.length; ++i) {
            if (supportedTrackTypes.filter(t => t == info.tracks[i].type).length > 0) {
                codecs.push(info.tracks[i].codec)
            }
        }

        const mime = "video/mp4; codecs=\"" + codecs.join(",") + "\"";

        myMediaSource = new MediaSource();
        myMediaSource.addEventListener("sourceopen", () => {
            console.log("media source is open!!! adding video buffer")
            videoSourceBuffer.current = myMediaSource.addSourceBuffer(mime)
            videoSourceBuffer.current.addEventListener("updateend", () => {
                readNextChunk();
            })
            console.log("added video source buffer ", videoSourceBuffer)
            readNextChunk();

        })

        const videoTag: HTMLVideoElement = document.getElementById("my-video") as HTMLVideoElement;
        videoTag.onerror = (e) => {
            console.error("video error", e, videoTag?.error)
        }
        videoTag.src = URL.createObjectURL(myMediaSource);

    }


    async function onReadFile(selectedFile: File,
                        onFileInfoReadyCb: (info: MP4Box.Movie) => void): Promise<void> {

        const mp4BoxFile: MP4Box.ISOFile<unknown, unknown> = createMp4BoxFile(onFileInfoReadyCb);

        while (!isInfoLoaded) {
            const chunk = await selectedFile.slice(nextBufferStart, nextBufferStart + BUFFER_SIZE_BYTES).arrayBuffer();
            console.log("reading file chunk at", nextBufferStart)
            const ab: MP4BoxBuffer = MP4BoxBuffer.fromArrayBuffer(chunk, nextBufferStart)
            nextBufferStart = mp4BoxFile.appendBuffer(ab, false);
        }

        nextBufferStart = 0;

    }

    return (
        <div className={"p-5 flex flex-col items-center justify-center"}>
            <input type="file" onChange={onFileChange} multiple={false} className={"my-3"}/>

            {selectedFile && displayFileInfo(selectedFile)}

            {selectedFile &&
                <div>
                    <button type={"button"} onClick={() => onReadFile(selectedFile, onFileInfoReadyCb)}
                            className="mt-10 text-white bg-green-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800" >
                        Read file {selectedFile.name}
                    </button>

                    <div>MP4Box bytes read: {mp4boxBytesRead}</div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                        <div className="bg-blue-400 h-2.5 rounded-full"
                             style={{"width": mp4boxLoadingProgress + "%"}}></div>
                    </div>

                    {mp4BoxFileInfo && displayMp4BoxFileInfo(mp4BoxFileInfo)}
                </div>
            }

            <video id={"my-video"} className={"border-4 border-red-700 mx-auto my-3 max-w-96"} controls autoPlay/>

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
                <tr>
                    <td className={"border border-gray-200 text-left p-2"}>Is Fragmented:</td>
                    <td className={"border border-gray-200 text-right p-2 font-bold"}>{info.isFragmented ? "true" : "false"}</td>
                </tr>
                <tr>
                    <td className={"border border-gray-200 text-left p-2"}>Is Progressive:</td>
                    <td className={"border border-gray-200 text-right p-2 font-bold"}>{info.isProgressive ? "true" : "false"}</td>
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

function createMp4BoxFile(onFileInfoReadyCb: (info: MP4Box.Movie) => void): MP4Box.ISOFile<unknown, unknown> {
    const mp4BoxFile: MP4Box.ISOFile<unknown, unknown> = MP4Box.createFile(true);

    mp4BoxFile.onError = (m: string, msg: string): void => {
        console.error(msg);
    };

    mp4BoxFile.onReady = (info: MP4Box.Movie): void => {
        console.info("received movie info", info);

        onFileInfoReadyCb(info)
    };

    return mp4BoxFile;
}


