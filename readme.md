
In-browser transcoding of video files with FFmpeg and WebAssembly
https://blog.scottlogic.com/2020/11/23/ffmpeg-webassembly.html

working ffmpeg conversion string
```shell
ffmpeg -i 20250219_065737.mp4 -movflags +default_base_moof+faststart+frag_keyframe+empty_moov -frag_duration 1000 c:\Users\epani\Downloads\output.mp4
```
copying codecs as well
```shell
ffmpeg -i 20250219_065737.mp4 -c copy -movflags +default_base_moof+faststart+frag_keyframe+empty_moov -frag_duration 1000 c:\Users\epani\Downloads\output.mp4
```

increasing fragment size (and making less chunks)
```shell
ffmpeg -i 20250219_065737.mp4 -c copy -movflags +default_base_moof+faststart+frag_keyframe+empty_moov -frag_duration 1000000 c:\Users\epani\Downloads\output.mp4
```