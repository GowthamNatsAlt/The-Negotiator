import React, { useState, useRef, useEffect } from 'react'
import toast from 'react-hot-toast';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const mimeType = 'video/webm; codecs="opus,vp8"';

function SingleShot({ user }) {
    const [permission, setPermission] = useState(false);
    const [stream, setStream] = useState(null);
    const mediaRecorder = useRef(null);
    const liveVideoFeed = useRef(null);
    const [recordingStatus, setRecordingStatus] = useState("inactive");
    const [recordedVideo, setRecordedVideo] = useState(null);
    const [videoChunks, setVideoChunks] = useState([]);
    const [currentText, setCurrentText] = useState("");

    // Start the livestream after getting permissions
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
        toast.success('Started recording');
        setRecordingStatus('recording');
        mediaRecorder.current = new MediaRecorder(stream, { mimeType });
        mediaRecorder.current.start();

        let localVideoChunks = [];

        mediaRecorder.current.ondataavailable = (event) => {
            if (typeof event.data === 'undefined' || event.data.size === 0) return;
            if (event.data.size === 0) return;
            localVideoChunks.push(event.data);
        };
        setVideoChunks(localVideoChunks);
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
    
                let response = null;

                await toast.promise(
                    fetch('http://127.0.0.1:8000/predict', {
                        method: 'POST',
                        body: formData,
                    })
                    .then(data => response = data), 
                {
                    loading: 'Retrieving sentiments and utterance.',
                    success: 'Successfully retrieved sentiments and utterance.',
                    error: 'Error retrieving sentiments and utterance.'
                })
    
                if (response.ok) {
                    const data = await response.json();
                    const llmtext = `${data.transcription} (${data.sentiment}).`
                    setCurrentText(llmtext);

                    // Logic to send video chunks and text involved
                    const timestamp = new Date().toISOString();
                    const storageRef = ref(storage, `${user.uid}/video-${timestamp}.webm`);
                    const uploadedFile = await uploadBytes(storageRef, videoBlob)
                    const url = await getDownloadURL(uploadedFile.ref);

                    let suggestion = "";

                    await toast.promise(
                        fetch('http://127.0.0.1:8001/generate', {
                            method: 'POST',
                            body: JSON.stringify(llmtext)
                        })
                        .then(async response => {
                            let data = await response.json();
                            suggestion = data.message;
                        }), 
                    {
                        loading: 'Retrieving suggestion.',
                        success: 'Successfully retrieved suggestions.',
                        error: 'Error retrieving suggestions.'
                    })
                    
                    await toast.promise(addDoc(collection(db, 'users', user.uid, 'videos'), {
                        videoUrl: url,
                        text: data.transcription,
                        timestamp: timestamp,
                        sentiment: data.sentiment,
                        llmtext: llmtext,
                        suggestion: suggestion
                    }), {
                        loading: 'Uploading entry to database.',
                        success: 'Successfully uploaded entry to database.',
                        error: 'Error uploading entry to database.'
                    });
                    setVideoChunks([]);
                }
            } catch (error) {
                console.error(error)
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
                setRecordingStatus("inactive");
            }
            setVideoChunks([]);
        } catch (error) {
            toast.error('Error stopping recording:', error.message);
        }        
    };

    return (
        <div className='flex flex-col justify-center items-center border-black rounded-lg border'>
            {/* <h1 className='text-center text-2xl'>Recorder</h1> */}

            {/* Space for video recording */}
            <div className='flex flex-col justify-center items-center my-10 gap-5'>
                <div className={`w-[479px] h-[390px] mx-5 bg-gray-200 p-4 rounded-xl`}>
                    <h1 className='text-center mb-2'>LiveStream</h1>
                    <video ref={liveVideoFeed} autoPlay className={`w-[479px] h-[330px] rounded-2xl ${!permission && "hidden"}`}></video>
                </div>
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
                            <button onClick={startRecording} type="button">
                                Start Recording
                            </button>
                        )}
                        {recordingStatus === 'recording' && (
                            <button onClick={stopRecording} type="button">
                                Stop Recording
                            </button>
                        )}
                    </>
                    )}
                </div>
            </div>
            
        </div>
    )
}

export default SingleShot
