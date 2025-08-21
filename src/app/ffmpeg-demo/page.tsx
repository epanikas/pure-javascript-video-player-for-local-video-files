"use client"

import {JSX, useRef} from "react"
import {useState} from "react";
import {ChangeEvent} from "react";
import {MP4BoxBuffer} from "mp4box";
import * as MP4Box from "mp4box"
import {useEffect} from "react";
import {FFmpeg} from "@ffmpeg/ffmpeg";
import {fetchFile, toBlobURL} from "@ffmpeg/util";
import dynamic from "next/dynamic";
import {MutableRefObject} from "react";
import {FSNode} from "@ffmpeg/ffmpeg";
import {FileData} from "@ffmpeg/ffmpeg";


type VideoSegment = {
    data: FileData
}

const BUFFER_SIZE_BYTES = 32768;


MP4Box.Log.setLogLevel(MP4Box.Log.info)

const supportedTrackTypes = ['audio', 'video']
let isInfoLoaded = false;
let isFragmentationFinished = false;

export default dynamic(() => Promise.resolve(TestPlayVideoSegmented), {
    ssr: false
})

function TestPlayVideoSegmented(): JSX.Element {

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        setSelectedFile(event.target.files![0]);
    };

    const [mp4boxLoadingProgress, setMp4boxLoadingProgress] = useState<number>(0);
    const [mp4boxBytesRead, setMp4boxBytesRead] = useState<number>(0);
    const [mp4BoxFileInfo, setMp4BoxFileInfo] = useState<MP4Box.Movie | null>(null);
    const [isFFMpegLoading, setIsFFMpegLoading] = useState<boolean>(false);
    const [downloadFragmentedUrls, setDownloadFragmentedUrls] = useState<{name: string, url: string}[]>([]);

    let myMediaSource: MediaSource;
    const videoSourceBuffer: MutableRefObject<SourceBuffer | null> = useRef(null);

    const segments: VideoSegment[] =[]
    var nextBufferStart = 0;

    function appendNextVideoSegment() {
        console.log("videoSourceBuffer", videoSourceBuffer)
        if (!videoSourceBuffer.current || videoSourceBuffer.current.updating) {
            return;
        }
        const segment: VideoSegment | undefined = segments.shift()
        if (segment) {
            if (typeof segment.data === "string") {
                videoSourceBuffer.current.appendBuffer(Buffer.from(segment.data))
            } else {
                videoSourceBuffer.current.appendBuffer(typedArrayToBuffer(segment.data))
            }
        } else {
            if (isFragmentationFinished) {
                if (myMediaSource.readyState === 'open') {
                    myMediaSource.endOfStream()
                }
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
                appendNextVideoSegment()
            })
            console.log("added video source buffer ", videoSourceBuffer)

        })

        const videoTag: HTMLVideoElement = document.getElementById("my-video") as HTMLVideoElement;
        videoTag.onerror = (e) => {
            console.error("video error", e, videoTag?.error)
        }
        videoTag.src = URL.createObjectURL(myMediaSource);

    }

    const ffmpegRef: MutableRefObject<FFmpeg> = useRef(new FFmpeg());
    const loadFFMpeg = async (): Promise<void> => {
        setIsFFMpegLoading(true);
        // const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";
        const baseURL = "/ffmpeg-assets";
        const ffmpeg = ffmpegRef.current;
        ffmpeg.on("log", ({message}) => {
            console.log("message", message)
        });
        // toBlobURL is used to bypass CORS issue, urls with the same
        // domain can be used directly.
        await ffmpeg.load({
            workerURL: await toBlobURL(`${baseURL}/worker.js`, "text/javascript"),
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
        });
        setIsFFMpegLoading(false);
    };


    useEffect(() => {
        loadFFMpeg();
    }, []);

    async function onReadFile(selectedFile: File, onFileInfoReadyCb: (info: MP4Box.Movie) => void): Promise<void> {

        const mp4BoxFile: MP4Box.ISOFile<unknown, unknown> = createMp4BoxFile(onFileInfoReadyCb);

        while (!isInfoLoaded) {
            const chunk = await selectedFile.slice(nextBufferStart, nextBufferStart + BUFFER_SIZE_BYTES).arrayBuffer();
            console.log("reading file chunk at", nextBufferStart)
            const ab: MP4BoxBuffer = MP4BoxBuffer.fromArrayBuffer(chunk, nextBufferStart)
            nextBufferStart = mp4BoxFile.appendBuffer(ab, false);
        }
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

            {isFFMpegLoading ? (
                <div>
                    <img alt={"loading..."} src={"/loading.gif"} width={"25px"} height={"25px"} className={"inline"}/> ffmpeg is loading
                </div>
            ) : (
                <div>
                    <div>
                        <span className={"text-green-500"}>ffmpeg is loaded</span>
                    </div>
                    <div>
                        <button type={"button"}
                                onClick={() => onFragmentFile(selectedFile!, ffmpegRef.current,
                                    (f: FileData) => {
                                        console.log("received segment from ffmpeg", f.length)
                                        segments.push({data: f});
                                        appendNextVideoSegment();
                                    },
                                    (name: string, url: string) => {
                                    console.log("appending download url for file ", name)
                                        downloadFragmentedUrls.push({name, url})
                                        setDownloadFragmentedUrls(downloadFragmentedUrls.slice())
                                    })}
                                className="mt-10 text-white bg-cyan-700 hover:bg-cyan-800 focus:ring-4 focus:ring-cyan -300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-cyan-600 dark:hover:bg-cyan-700 focus:outline-none dark:focus:ring-cyan-800" >
                            Fragment file {selectedFile?.name}
                        </button>

                        {downloadFragmentedUrls &&
                                downloadFragmentedUrls
                                    .map(dfu =>
                                        <a key={dfu.name} href={dfu.url} download={`fragmented-${dfu.name}`}>download fragmented file {dfu.name}</a>)
                        }
                    </div>
                </div>
            )}

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

function createMp4BoxFile(onFileInfoReadyCb: (info: MP4Box.Movie) => void): MP4Box.ISOFile<unknown, unknown> {
    const mp4BoxFile: MP4Box.ISOFile<unknown, unknown> = MP4Box.createFile(true);

    mp4BoxFile.onError = (m: string, msg: string) => {
        console.error(msg);
    };

    mp4BoxFile.onReady = (info: MP4Box.Movie) => {
        console.info("received movie info", info);

        onFileInfoReadyCb(info)
    };

    return mp4BoxFile;
}

function typedArrayToBuffer(array: Uint8Array): ArrayBuffer {
    return array.buffer.slice(array.byteOffset, array.byteLength + array.byteOffset) as ArrayBuffer
}

async function onFragmentFile(selectedFile: File, ffmpeg: FFmpeg,
                              enqueueVideoSegment: (f: FileData) => void,
                              appendDownloadDataBlobUrl: (name: string, url: string) => void): Promise<void> {

    await ffmpeg.writeFile("/" + selectedFile.name, await fetchFile(selectedFile ));

    await ffmpeg.createDir("/fragmented-output")

    const processListDir = async () => {
        const listdir: FSNode[] = await ffmpeg.listDir("/fragmented-output");
        console.log("received listdir", listdir)
        const processed: string[] = await Promise.all(listdir
            .filter((d: FSNode) => d.name.startsWith("output"))
            .sort((a: FSNode, b: FSNode): number => a.name < b.name ? -1 : 1)
            .map(async (d: FSNode) => {
                const data: FileData = (await ffmpeg.readFile(`/fragmented-output/${d.name}`)) as FileData;

                enqueueVideoSegment(data)

                console.log("data is ", data.length, d.name)

                var dataBlob: Blob = new Blob([typedArrayToBuffer(data as Uint8Array)], {type: "video/mp4"});
                const dataBlobUrl = window.URL.createObjectURL(dataBlob);
                appendDownloadDataBlobUrl(d.name, dataBlobUrl)

                await ffmpeg.deleteFile(`/fragmented-output/${d.name}`);

                return d.name;
            }))

        console.log("processed", processed);
        if (!isFragmentationFinished) {
            setTimeout(processListDir, 100)
        } else {
            console.log("finished polling fragmentation")
        }

    }
    setTimeout(processListDir, 2000)

    // const res = await ffmpeg.exec([
    //     "-i", "/" + selectedFile.name/*"/input.avi"*/,
    //     // Encode for MediaStream
    //     "-segment_format_options",
    //     "movflags=frag_keyframe+empty_moov+default_base_moof",
    //     // encode 5 second segments
    //     "-segment_time",
    //     "5",
    //
    //     "/output.mp4"]);

    // const res = await ffmpeg.exec([
    //     "-i", "/" + selectedFile.name/*"/input.avi"*/,
    //     "-c:v",  "libx264", "-b:v", "1000k", "-c:a", "aac", "-b:a", "128k",
    //     "-f", "segment",
    //     "-movflags", "frag_keyframe+empty_moov+faststart",
    //     // "-segment_format_options", "movflags=+faststart+frag_keyframe+empty_moov+default_base_moof",
    //     "-segment_format_options", "movflags=+frag_keyframe+empty_moov+default_base_moof",
    //     "-segment_time", "5",
    //     "/fragmented-output/output-%d.mp4"]);


    // const res = await ffmpeg.exec([
    //     "-i", "/" + selectedFile.name,
    //     // "-f", "alsa", "-ac", "1", "-i", "hw:2", "-g", "64", "-pix_fmt", "yuv420p", "-profile:v", "baseline", "-vcodec", "libx264", "-crf", "35",
    //     "-segment_time", "30:00",
    //     "-f", "segment",
    //     "-reset_timestamps", "1",
    //     "-strftime", "1",
    //     "-segment_format_options", "movflags=frag_keyframe+empty_moov:flush_packets=1",
    //     "/fragmented-output/output-%d.mp4"
    // ]);
    const res = await ffmpeg.exec([
        "-i", "/" + selectedFile.name,
        // "-movflags", "frag_keyframe+empty_moov+faststart",
        // "-segment_format_options", "movflags=+frag_keyframe+empty_moov+default_base_moof",
        // "-segment_time", "5",
        "-c", "copy", "-movflags", "+default_base_moof+faststart+frag_keyframe+empty_moov", "-frag_duration", "1000000",
        "/fragmented-output/output.mp4"
    ]);
    console.log("fragmenting res", res)


    isFragmentationFinished = true;

    const urls: {name: string, url: string}[] = []


    // setDownloadFragmentedUrl(urls)

}

