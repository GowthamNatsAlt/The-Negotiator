import React, { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, orderBy, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import SingleShot from './SingleShot';

function EmotionalContext({ user }) {

    const [emotions, setEmotions] = useState([]);
    const [current, setCurrent] = useState(0);

    useEffect(() => {
        const q = query(collection(db, "users", user.uid, "videos"), orderBy("timestamp", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const updatedEmotions = snapshot.docs.map((doc) => doc._document.data.value.mapValue.fields);
            setEmotions(updatedEmotions);
            console.log(emotions)
        });
        return () => unsubscribe();
    }, [user])

  return (
    <div className='w-full h-[780px] flex flex-col items-center gap-4'>
        <div className='w-full h-2/3 p-6 flex flex-row justify-center gap-5'>
            <SingleShot user={user} />
            <div className='ml-10 h-full'>
                <div className='h-full overflow-auto p-4 border border-black rounded-lg'>
                    <h1 className='text-lg font-bold text-center'>Emotional Context</h1>
                    { emotions.length > 0 && emotions.map((emotion, index) => (
                        <>
                            <button onClick={() => setCurrent(index)} className={`w-full flex gap-8 justify-between my-2 px-4 py-2 border-black border rounded ${current === index && "bg-gray-200"}`} key={index}>
                                <h1 className=''>{emotion.llmtext.stringValue}</h1>
                                <h1 className=''>{emotion.timestamp.stringValue.slice(0, 10)}, {emotion.timestamp.stringValue.slice(11, 19)}</h1>
                            </button>
                            
                        </>
                    ))}
                </div>
            </div>
        </div>
        <div className='w-3/4 p-4 h-1/3 border border-black rounded-md overflow-auto'>
            <h1 className='text-lg font-bold text-center my-2'>Suggestion</h1>
            { emotions.length > 0 && (
                    <p className='text-justify'>{emotions[current].suggestion.stringValue}</p>
            )}
        </div>
    </div>
  )
}

export default EmotionalContext