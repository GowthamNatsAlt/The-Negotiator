import tensorflow as tf
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import numpy as np, pandas as pd, sklearn
from feat import Detector
import librosa as lb
import aiofiles
import cv2
import subprocess
import speech_recognition as sr
import moviepy.editor as mp
import opensmile
from transformers import AutoTokenizer, TFAutoModelForSequenceClassification
from dotenv import load_dotenv
import os
from deepgram import (
    DeepgramClient,
    PrerecordedOptions,
    FileSource,
)
import json

load_dotenv()
API_KEY = os.getenv("API_KEY")

# FastAPI app Init
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sentiments = ["Anger", "Disgust", "Fear", "Joy", "Neutral", "Sadness", "Surprise"]

# Model loading
checkpoint = "distilbert/distilroberta-base"
tokenizer = AutoTokenizer.from_pretrained(checkpoint)
model = TFAutoModelForSequenceClassification.from_pretrained(checkpoint, num_labels=len(sentiments))
model.load_weights("./distilroberta-augmented.h5")

# Feature Extractor init
smile = opensmile.Smile(
    feature_set=opensmile.FeatureSet.eGeMAPSv02,
    feature_level=opensmile.FeatureLevel.Functionals,
)

detector = Detector(
    face_model="retinaface",
    landmark_model="mobilefacenet",
    au_model="svm",
    emotion_model="resmasknet",
    device="cuda",
    n_jobs=5
)

# Transcription
deepgram = DeepgramClient("Your API KEY")
options = PrerecordedOptions(
    model="nova-2",
    smart_format=True,
)

### AUDIO FEATURES
def loud_check(value):
    loudness = "quiet"
    if value > -30:
        loudness = "loud"
    elif value > -50 and value <= -30:
        loudness = "moderate"
    return f"The speaker has a {loudness} overall volume. "

def pitch_check(stability_value, emphasis_value):
    string = ""

    if stability_value > 0.18 and stability_value < 0.5:
        string += "The speaker has a moderately stable pitch. "
    elif stability_value <= 0.18:
        string += "The speaker has a relatively stable pitch. "
    else:
        string += "The speaker has an unstable pitch. "

    if emphasis_value > 5:
        string += "The speaker emphasizes strongly. "
    elif emphasis_value <= 2:
        string += "The speaker emphasizes moderately. "
    else:
        string += "The speaker emphasizes weakly. "

    return string

def spectral_flux_check(value):
    if value < 0.1: 
        return "The audio has a relatively stable frequency content. "
    elif value < 0.5:
        return "The audio has a moderately dynamic frequency content. "
    else:
        return "The audio has a highly dynamic frequency content. "
    
def mfcc_check(mfcc1, mfcc2, mfcc3, mfcc4):
    if mfcc1 > mfcc2 and mfcc3 > mfcc4:
        return "The audio has a dominant spectral peak in the lower frequencies. "
    elif mfcc2 > mfcc1 and mfcc3 > mfcc4:
        return "The audio has it's energy distributed across various frequencies, with a slight emphasis on the lower-mid frequencies. "
    elif mfcc3 > mfcc1 and mfcc3 > mfcc2:
        return "The audio has it's energy distributed across various frequencies, with a potential emphasis on the higher frequencies. "
    else:
        return "The audio has a less distinct spectral distribution pattern. "

def get_audio_features(filepath):
    try: 
        data, sample_rate = lb.load(filepath)

        # Get OpenSmile Features
        features = smile.process_signal(data, sample_rate)
        feature_columns = list(features.columns)
        feature_values = features.values[0]

        # Alter the string
        string = ""

        string += loud_check(feature_values[feature_columns.index("equivalentSoundLevel_dBp")])
        string += pitch_check(feature_values[feature_columns.index("F0semitoneFrom27.5Hz_sma3nz_stddevNorm")], feature_values[feature_columns.index("F0semitoneFrom27.5Hz_sma3nz_pctlrange0-2")])
        string += spectral_flux_check(feature_values[feature_columns.index("spectralFlux_sma3_amean")])
        string += mfcc_check(feature_values[feature_columns.index("mfcc1_sma3_amean")], feature_values[feature_columns.index("mfcc2_sma3_amean")], feature_values[feature_columns.index("mfcc3_sma3_amean")], feature_values[feature_columns.index("mfcc4_sma3_amean")])
        
        return string
    except Exception as e:
        print(e)
        return None
    

### FACIAL FEATURES 
action_units = [
    "The speaker raises their inner eyebrows. ",
    "The speaker raises their outer eyebrows. ",
    "The speaker lowers their brows. ",
    "The speaker raises their upper eyelid. ",
    "The speaker raises their cheeks. ",
    "The speaker tightens their eyelids. ",
    "The speaker wrinkles their nose. ",
    "The speaker raises their upper lip. ",
    "The speaker deepens the lines around their nose and mouth. ",
    "The speaker pulls the corners of their lips outward. ",
    "The speaker forms dimples. ",
    "The speaker depresses the corners of their lips. ",
    "The speaker raises their chin. ",
    "The speaker stretches their lips. ",
    "The speaker tightens their lips. ",
    "The speaker presses their lips together. ",
    "The speaker parts their lips slightly. ",
    "The speaker lowers their jaw significantly. ",
    "The speaker stretches their neck. ",
    "The speaker closes their eyes completely. "
]

def get_video_features(file_path):
    string = ""
    try:
        video_prediction = detector.detect_video(file_path, skip_frames=30)
        aus = np.mean(video_prediction.aus.values, axis=0)
        for i in range(len(aus)):
            if aus[i] >= 0.5:
                string += action_units[i]
        return string

    except Exception as e:
        print(e)
        return None


@app.get("/")
async def test_root():
    return {
        "message": "Hello World"
    }

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    try:
        async with aiofiles.open("temp_video.webm", "wb") as temp_file:
            file_contents = file.file.read()
            await temp_file.write(file_contents)
        await temp_file.close()

        # Convert it to the correct codec
        ffmpeg_command = [
            "ffmpeg",
            "-y",
            "-i", "temp_video.webm",
            "-c:v", "libx264",
            "-c:a", "aac",
            "output_video.mp4"
        ]

        subprocess.run(ffmpeg_command, check=True)

        filepath = "output_video.mp4"

        input_text = f"audio: {get_audio_features(filepath)}facial: {get_video_features(filepath)}<|endoftext|>"
        print(input_text)

        encoded_input_text = tokenizer(
            [input_text],
            padding=True,
            truncation=True,
            return_tensors="tf"
        )
        preds = np.argmax(model.predict([dict(encoded_input_text)])[0])
        sentiment = sentiments[preds]

        with open(filepath, "rb") as file:
            buffer_data = file.read()

        payload: FileSource = {
            "buffer": buffer_data,
        }

        response = deepgram.listen.prerecorded.v("1").transcribe_file(payload, options)

        final_transcription = json.loads(response.to_json())['results']['channels'][0]['alternatives'][0]['transcript']

        return {
            "sentiment":  sentiment,
            "transcription": final_transcription,
            "input text": input_text
        }
    except sr.exceptions.UnknownValueError:
        return {
            "sentiment": sentiment,
            "text": "No text found"
        }
    except Exception as e:
        print(f"Error: {e}")