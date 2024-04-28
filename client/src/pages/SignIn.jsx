import React, {useEffect} from 'react';
import { GoogleButton } from 'react-google-button';
import { UserAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

function SignIn() {
  const { googleSignIn, user } = UserAuth();
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    try {
      await googleSignIn();
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    if (user != null) {
      navigate('/recorder');
    }
  }, [user]);

  return (
    <div className='h-screen flex flex-col pb-20 items-center justify-center'>
      <h1 className=' text-6xl py-16 font-semibold'>Introducing the Negotiator</h1>
      <h3 className='text-3xl pb-12'>An AI-based Negotiation Assistant</h3>
      <p className='pb-12 w-1/2 text-lg text-center'>Negotiate with confidence and achieve better outcomes with the Negotiator, the revolutionary web app that empowers you to analyze your own performance and become a negotiation pro! Click the button below to get started.</p>
      <div className='py-4'>
        <GoogleButton onClick={handleGoogleSignIn} />
      </div>
    </div>
  )
}

export default SignIn