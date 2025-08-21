import {JSX} from "react";

export default function TestPlayVideoSegmented(): JSX.Element {

    return (
        <div className={"container text-center prose prose-emerald prose-lg dark:prose-invert mx-auto mb-10"}>
            <h1>The demo page for the blog articles</h1>

            <p>
                <a href={"https://epanikas.hashnode.dev/play-local-mp4-video-files-in-your-browser-pure-javascript-video-player-tutorial"}>
                    Play Local MP4 Video Files in Your Browser (part I): Pure JavaScript Video Player Tutorial with MP4Box library
                </a>
            </p>

            <p>
                <a href={"https://epanikas.hashnode.dev/play-local-mp4-video-files-in-your-browser-part-ii-pure-javascript-video-player-tutorial-based-on-ffmpeg-library"}>
                    Play Local MP4 Video Files in Your Browser (part II): Pure JavaScript Video Player Tutorial based on ffmpeg library
                </a>
            </p>

            <h2><a href={"/bare-file-demo"}>Playing a video file directly</a></h2>

            <p>
                This page allows to verify if a video file is playable using MSE mechanism as it is, without any preprocessing.
            </p>

            <p>
                Recall that for a video file to be suitable for modern browser's Media Source Extension (MSE) it should be <i><b>fragmented</b></i>.
            </p>

            <h2><a href={"/mp4box-demo"}>Playing a video file using MP4Box library</a></h2>

            <p>
                This page can accept any video file, and it is supposed to play it via the MSE in browser by using MP4Box library to fragment the video file prior to playing it.
            </p>

            <p>
               The MP4Box library is designed to process the video files on the fly, which allows for on-the-fly fragmentation and playing in MSE.
            </p>

            <h2><a href={"/ffmpeg-demo"}>Playing a video file using ffmpeg library</a></h2>

            <p>
                This page can accept any video file, and it would preprocess it for fragmentation using the <i><b>ffmpeg</b></i> library.
            </p>

            <p>
               Once the video file is ready, it should start immediately playing, and also a download url should appear.
            </p>

            <p>
               When we download the fragmented video file, it is normally should be suitable to be played by MSE right away (so you can test it using <a href={"/bare-file-demo"}>bare-file-demo</a>./)
            </p>


        </div>


    )

}