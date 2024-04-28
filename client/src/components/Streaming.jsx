import React, { useState, useRef, useEffect } from 'react'
import toast from 'react-hot-toast';

const mimeType = 'video/webm; codecs="opus,vp8"';

function Streaming() {
    const [permission, setPermission] = useState(false);
    const [stream, setStream] = useState(null);
    const mediaRecorder = useRef(null);
    const liveVideoFeed = useRef(null);
    const [recordingStatus, setRecordingStatus] = useState("inactive");
    const [recordedVideo, setRecordedVideo] = useState(null);
    const [videoChunks, setVideoChunks] = useState([]);
    const [timerId, setTimerId] = useState(null);

    // Start the livestream adter getting permissions
    const startStream = async () => {
        setRecordedVideo(null);

        if ("MediaRecorder" in window) {
            try {
                const videoConstraints = {
                    audio: false,
                    video: true
                };
                const audioConstraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
                };

                const audioStream = await navigator.mediaDevices.getUserMedia(
                    audioConstraints
                );
                const videoStream = await navigator.mediaDevices.getUserMedia(
                    videoConstraints
                );

                const combinedStream = new MediaStream([
                    ...videoStream.getVideoTracks(),
                    ...audioStream.getAudioTracks(),
                ]);

                setStream(combinedStream);
                liveVideoFeed.current.srcObject = videoStream;
                setPermission(true);
                toast.success('Stream started');

            } catch (err) {
                toast.error(err.message);
            }
        } else {
            toast.error("The MediaRecorder API is not supported in your browser.");
        }
    };

    // Stop livestream
    const stopStream = () => {
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
            setStream(null);
            setPermission(false);
            toast.success('Stream stopped');
        }
    };

    // Start recording and store the intermediary chunks
    const startRecording = () => {
        mediaRecorder.current = new MediaRecorder(stream, { mimeType });
        mediaRecorder.current.start();

        mediaRecorder.current.ondataavailable = (event) => {
            if (typeof event.data === 'undefined' || event.data.size === 0) return;
            if (event.data.size === 0) return;
            setVideoChunks(prevChunks => [...prevChunks, event.data]);
            console.log(videoChunks.length);
        };
    };

    // Send chunks to API 
    const sendChunksToAPI = async () => {
        if (videoChunks.length > 0) {
            const videoBlob = new Blob(videoChunks, { type: mimeType });
            const videoUrl = URL.createObjectURL(videoBlob);
    
            setRecordedVideo(videoUrl);
    
            try {
                const formData = new FormData();
                formData.append('file', videoBlob, 'video.webm');
    
                const response = await fetch('http://127.0.0.1:8000/predict', {
                    method: 'POST',
                    body: formData,
                });
    
                if (response.ok) {
                    toast.success('Chunk uploaded successfully!');
                    const data = await response.json();
                    toast(`Sentiment: ${data.sentiment}, Text: ${data.text}`);
                    setVideoChunks([]); // Clear chunks after successful upload
                } else {
                    toast.error('Error uploading chunk:', response.statusText);
                }
            } catch (error) {
                toast.error('Error sending chunk to API:', error.message);
            }
        }
    };

    // Stop recording and send remaining chunks to API
    const stopRecording = async () => {
        try {
            mediaRecorder.current.stop();
            mediaRecorder.current.onstop = async () => {
                await sendChunksToAPI();
            }
            setVideoChunks([]);
        } catch (error) {
            toast.error('Error stopping recording:', error.message);
        }        
    };

    const startStopRecording = async () => {
        startRecording();
        setTimeout(() => {
            stopRecording();
        }, 2800); // Stop recording after 2.8 seconds
    };

    const handleStartButtonClick = () => {
        toast.success('Started recording');
        setRecordingStatus('recording');
        setTimerId(setInterval(startStopRecording, 5000));
    };
    
    const handleStopButtonClick = () => {
        clearInterval(timerId);
        setRecordingStatus("inactive");
        toast.success('Stopped recording');
    };

    return (
        <>
            <h1 className='text-center text-2xl pt-12'>Recorder</h1>

            {/* Space for video recording */}
            <div className='flex flex-row my-10'>
                <div className={`w-[479px] h-[420px] mx-5 bg-gray-200 p-4`}>
                    <h1 className='text-center'>LiveStream</h1>
                    <video ref={liveVideoFeed} autoPlay className="w-[479px] h-[358px]"></video>
                </div>
                <div className='w-[479px] h-[420px] mx-5 bg-gray-200 p-4'>
                    <h1 className='text-center'>Recording</h1>
                    {recordedVideo ? (
                        <video className=' w-[479px] h-[358px]' src={recordedVideo} controls></video>
                    ) : null}
                </div>
            </div>
            
            {/* Video Controls */}
            <div className='flex flex-row gap-2'>
                {!permission ? (
                    <button onClick={startStream} type="button">
                        Start Stream
                    </button>
                ) : (
                <>
                    <button onClick={stopStream} type="button">
                        Stop Stream
                    </button>
                    {permission && recordingStatus === 'inactive' && (
                        <button onClick={handleStartButtonClick} type="button">
                            Start Recording
                        </button>
                    )}
                    {recordingStatus === 'recording' && (
                        <button onClick={handleStopButtonClick} type="button">
                            Stop Recording
                        </button>
                    )}
                </>
                )}
            </div>
        </>
    )
}

export default Streaming
