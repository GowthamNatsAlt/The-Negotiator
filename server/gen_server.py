import requests
import json
from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import markdown
from bs4 import BeautifulSoup

import google.generativeai as genai

genai.configure(api_key="Your Api Key")
model = genai.GenerativeModel('gemini-pro')

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def test_root():
    return {
        "message": "Hello World"
    }

@app.post("/generate")
async def predict(string:str = Body(...)):
    try:
        string = string[1:-1]
        sentiment = string[string.find("(") + 1 : -1].lower()
        answer = "Assume yourself as a professional communication coach and reply to the question in accordance to the context. "
        if sentiment == "joy":
            answer += f"Context: {string}Question: Praise me in 100 words relating to the context that I'm doing good in that professional conversation. Answer:"
        elif sentiment == "surprise":
            answer += f"Context: {string}Question: Just give me 3 general suggestions in 100 words to retain the interest of the speaker created with reference to the professional context. Answer:"
        elif sentiment == "fear":
            answer += f"Context: {string}Question: Just give me 3 suggestions in 100 words relating to the context to ease the situation of the speaker in a professional context. Answer:"
        elif sentiment == "anger":
            answer += f"Context: {string}Question: Just give me 3 suggestions in 100 words relating to the context to defuse the situation in a professional context. Answer:"
        elif sentiment == "disgust" or sentiment == "sadness":
            answer += f"Context: {string}Question: Just give me 3 suggestions in 100 words relating to the context to improve the mood of the speaker in a professional context. Answer:"
        else:
            answer += f"Context: {string}Question: Just give me 3 suggestions in 100 words to improve the situation in the conversation within the context in a professional context. Answer:"

        response = model.generate_content(answer)
        html = markdown.markdown(response.text)
        soup = BeautifulSoup(html, features='html.parser')

        return {
            "message": soup.get_text(),
            "html": html
        }
    except Exception as e:
        print(e)
        return None