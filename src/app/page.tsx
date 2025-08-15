"use client"

import {JSX, useRef} from "react"
import {useState} from "react";
import {ChangeEvent} from "react";
import {MP4BoxBuffer} from "mp4box-forked";
import * as MP4Box from "mp4box-forked"
import {useEffect} from "react";
import {FFmpeg} from "@ffmpeg/ffmpeg";
import {fetchFile, toBlobURL} from "@ffmpeg/util";
import dynamic from "next/dynamic";
import {MutableRefObject} from "react";
import {FSNode} from "@ffmpeg/ffmpeg";

type InitSegsType = {
    tracks: {
        id: number;
        user: unknown;
    }[];
    buffer: MP4BoxBuffer;
}

type VideoSegment = {
    id: number;
    user: unknown;
    buffer: ArrayBuffer;
    nextSample: number;
    last: boolean;
}

MP4Box.Log.setLogLevel(MP4Box.Log.info)

const supportedTrackTypes = ['audio', 'video']

function TestPlayVideoSegmented(): JSX.Element {

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        setSelectedFile(event.target.files![0]);
    };

    const [mp4boxLoadingProgress, setMp4boxLoadingProgress] = useState<number>(0);
    const [mp4boxBytesRead, setMp4boxBytesRead] = useState<number>(0);
    const [mp4BoxFileInfo, setMp4BoxFileInfo] = useState<MP4Box.Movie | null>(null);
    const [isFFMpegLoading, setIsFFMpegLoading] = useState<boolean>(false);
    // const [isFFMpegLoaded, setIsFFMpegLoaded] = useState<boolean>(false);
    const [downloadFragmentedUrl, setDownloadFragmentedUrl] = useState<{name: string, url: string}[]>([]);

    const bytesToProgress = (bytesRead: number) => {
        setMp4boxBytesRead(bytesRead);
        setMp4boxLoadingProgress((bytesRead / selectedFile!.size) * 100)
    };

    let myMediaSource: MediaSource;
    let videoSourceBuffer: SourceBuffer;

    let isLastSegment = false;
    const segments: VideoSegment[] =[]

    function onFileInfoReadyCb(info: MP4Box.Movie, initSegs: InitSegsType): void {
        setMp4BoxFileInfo(info)

        let codecs: string[] = [];
        for (let i = 0; i < info.tracks.length; ++i) {
            if (supportedTrackTypes.filter(t => t == info.tracks[i].type).length > 0) {
                codecs.push(info.tracks[i].codec)
            }
        }

        const mime = "video/mp4; codecs=\"" + codecs.join(",") + "\"";

        myMediaSource = new MediaSource();
        myMediaSource.addEventListener("sourceopen", () => {
            videoSourceBuffer = myMediaSource.addSourceBuffer(mime)
            videoSourceBuffer.addEventListener("updateend", () => {
                const segment: VideoSegment | undefined = segments.shift()
                if (segment) {
                    isLastSegment = segment.last;
                    videoSourceBuffer.appendBuffer(segment.buffer)
                } else {
                    if (isLastSegment) {
                        if (myMediaSource.readyState === 'open') {
                            myMediaSource.endOfStream()
                        }
                    }
                }
            })
            videoSourceBuffer.appendBuffer(initSegs.buffer)

        })

        const videoTag: HTMLVideoElement = document.getElementById("my-video") as HTMLVideoElement;
        videoTag.onerror = (e) => {
            console.error("video error", e, videoTag?.error)
        }
        videoTag.src = URL.createObjectURL(myMediaSource);

    }

    function onSegmentReadyCb(id: number, user: unknown, buffer: ArrayBuffer, nextSample: number, last: boolean): void {
        segments.push({id, user, buffer, nextSample, last})
    }

    const ffmpegRef: MutableRefObject<FFmpeg> = useRef(new FFmpeg());
    const load = async (): Promise<void> => {
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
        load();
    }, []);

    return (
        <div className={"p-5 flex flex-col items-center justify-center"}>
            <input type="file" onChange={onFileChange} multiple={false} className={"my-3"}/>

            {selectedFile && displayFileInfo(selectedFile)}

            {selectedFile &&
                <div>
                    <button type={"button"} onClick={() => onReadFile(selectedFile, onFileInfoReadyCb, onSegmentReadyCb, bytesToProgress)}
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

            <video id={"my-video"} className={"border-4 border-red-700 mx-auto my-3 max-w-96"} controls autoPlay/>

            {isFFMpegLoading ? (
                <div>
                    <img alt={"loading..."} src={"/loading.gif"} width={"25px"} height={"25px"} className={"inline"}/> ffmpeg is loading
                </div>
            ) : (
                <div>
                    <span className={"text-green-500"}>ffmpeg is loaded</span>
                    <button type={"button"}
                            onClick={() => onFragmentFile(selectedFile!, ffmpegRef.current, setDownloadFragmentedUrl)}
                            className="mt-10 text-white bg-cyan-700 hover:bg-cyan-800 focus:ring-4 focus:ring-cyan -300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-cyan-600 dark:hover:bg-cyan-700 focus:outline-none dark:focus:ring-cyan-800"
                    >Fragment file {selectedFile?.name}
                    </button>
                    {downloadFragmentedUrl && downloadFragmentedUrl
                        .map(dfu =>
                            <a href={dfu.url} download={`fragmented-${dfu.name}`}>download fragmented file {dfu.name}</a>)
                    }
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

function onReadFile(selectedFile: File,
                    onFileInfoReadyCb: (info: MP4Box.Movie, initSegs: InitSegsType) => void,
                    onSegmentReadyCb: (id: number, user: unknown, buffer: ArrayBuffer, nextSample: number, last: boolean) => void,
                    bytesToProgress: (p: number) => void): void {

    const mp4BoxFile: MP4Box.ISOFile<unknown, unknown> = createMp4BoxFile(onFileInfoReadyCb, onSegmentReadyCb);

    selectedFile.stream().pipeTo(readStreamIntoMp4IsoFile(mp4BoxFile, bytesToProgress));

}

function createMp4BoxFile(onFileInfoReadyCb: (info: MP4Box.Movie, initSegs: InitSegsType) => void,
                          onSegmentReadyCb: (id: number, user: unknown, buffer: ArrayBuffer, nextSample: number, last: boolean) => void): MP4Box.ISOFile<unknown, unknown> {
    const mp4BoxFile: MP4Box.ISOFile<unknown, unknown> = MP4Box.createFile(true);

    mp4BoxFile.onError = (m: string, msg: string) => {
        console.error(msg);
    };

    mp4BoxFile.onReady = (info: MP4Box.Movie) => {
        console.info(info);

        var options = { nbSamples: 1000, sizePerSegment: 1048576  /*1Mb*/};
        for (let i = 0; i < info.tracks.length; ++i) {
            if (supportedTrackTypes.filter(t => t == info.tracks[i].type).length > 0) {
                console.log("adding segmentation option for track ", info.tracks[i].id, info.tracks[i].type)
                mp4BoxFile.setSegmentOptions(info.tracks[i].id, info.tracks[i].type, options);
            }
        }
        var initSegs: InitSegsType = mp4BoxFile.initializeSegmentation();

        onFileInfoReadyCb(info, initSegs)

        mp4BoxFile.start();
    };

    mp4BoxFile.onSegment = (id: number, user: unknown, buffer: ArrayBuffer, nextSample: number, last: boolean) => {
        console.log("segment received", "id", id, "user", user, "buffer", buffer.byteLength, "nextSample", nextSample, last);
        onSegmentReadyCb(id, user, buffer, nextSample, last)
    }

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

async function onFragmentFile(selectedFile: File, ffmpeg: FFmpeg, setDownloadFragmentedUrl: (s: { name: string, url: string }[]) => void): Promise<void> {

    // u can use 'https://ffmpegwasm.netlify.app/video/video-15s.avi' to download the video to public folder for testing
    await ffmpeg.writeFile(
        // "/input.avi",
        "/" + selectedFile.name,
        await fetchFile(selectedFile/*
            "https://raw.githubusercontent.com/ffmpegwasm/testdata/master/video-15s.avi"*/
        )
    );

    // await ffmpeg.deleteDir("/fragmented-output")
    await ffmpeg.createDir("/fragmented-output")
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

    const res = await ffmpeg.exec([
        "-i", "/" + selectedFile.name,
        // "-f", "alsa", "-ac", "1", "-i", "hw:2", "-g", "64", "-pix_fmt", "yuv420p", "-profile:v", "baseline", "-vcodec", "libx264", "-crf", "35",
        "-segment_time", "30:00",
        "-f", "segment",
        "-reset_timestamps", "1",
        "-strftime", "1",
        "-segment_format_options", "movflags=frag_keyframe+empty_moov:flush_packets=1",
        "/fragmented-output/output-%d.mp4"
    ]);
    console.log("fragmenting res", res)

    const urls: {name: string, url: string}[] = []

    const dir: FSNode[] = await ffmpeg.listDir("/fragmented-output")
    console.log("dir", dir)
    await Promise.all(dir.map(async (d: FSNode) => {
        if (d.name.startsWith("output")) {
            const data = (await ffmpeg.readFile(`/fragmented-output/${d.name}`)) as any;
            console.log("data is ", data.length)

            var dataBlob: Blob = new Blob([data], {type: "video/mp4"});
            const textFile = window.URL.createObjectURL(dataBlob);

            urls.push({name: d.name, url: textFile})
        }
    }))


    setDownloadFragmentedUrl(urls)

}

export default dynamic(() => Promise.resolve(TestPlayVideoSegmented), {
    ssr: false
})
