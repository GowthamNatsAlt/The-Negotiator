import React, { useEffect, useState } from 'react';
import { UserAuth } from "../context/AuthContext";
import toast from 'react-hot-toast';
// import Streaming from '../components/Streaming';
import SingleShot from '../components/SingleShot';
import EmotionalContext from '../components/EmotionalContext';

function Recorder() {

  const { user } = UserAuth();
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {    
    if (user && user.displayName) {
      async function greetUserToast() {
        await toast(`Hello ${user.displayName}`);
        setIsLoaded(true);
      }

      greetUserToast();
    }
  }, [user])

  return (
    <>
      <div className='flex items-center w-full p-10 pt-0'>       
        {user && user.displayName && isLoaded && (
          <div className='w-full flex flex-row my-10'>
            <EmotionalContext user={user} />
          </div>
        )}
      </div>
    </>
  )
}

export default Recorder