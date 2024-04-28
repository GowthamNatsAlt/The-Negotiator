import React from "react";
import { Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import SignIn from "./pages/SignIn";
import Recorder from "./pages/Recorder";
import { AuthContextProvider } from "./context/AuthContext.jsx";
import Protected from "./components/Protected.jsx";
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <>
      <AuthContextProvider>
        <Toaster />
        <Routes>
          <Route path="/" element={<SignIn />} />
          <Route 
            path="/recorder" 
            element={
              <Protected>
                <div className="w-full h-screen">
                  <Navbar />
                  <Recorder />
                </div>
              </Protected>
            } 
          />
        </Routes>
      </AuthContextProvider>
    </>
  )
}

export default App
