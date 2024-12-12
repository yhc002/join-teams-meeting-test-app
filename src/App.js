import { useState, useRef } from "react";
import { CallClient, VideoStreamRenderer, LocalVideoStream } from "@azure/communication-calling";
import { AzureCommunicationTokenCredential } from '@azure/communication-common';
import './App.css';


let call;
let callAgent;
let deviceManager;
let camera;
let mic;

let localVideoStream;
let localVideoStreamRenderer;


// const meetingLinkInput = document.getElementById('teams-link-input');

// const remoteVideosGallery = document.getElementById('remoteVideosGallery');
// const localVideoContainer = document.getElementById('localVideoContainer');

// const hangUpButton = document.getElementById('hang-up-button');
// const teamsMeetingJoinButton = document.getElementById('join-meeting-button');
// const callStateElement = document.getElementById('call-state');

function App() {
  const [inited,setInited] = useState(false)
  const [joined, setJoined] = useState(false)
  
  const tokenRef = useRef(0)
  const meetingLinkInputRef = useRef(0)
  const remoteVideosGalleryRef = useRef(0)
  const localVideoContainerRef = useRef(0)

async function init() {
  const callClient = new CallClient();
  const tokenCredential = new AzureCommunicationTokenCredential(tokenRef.current.value);
  callAgent = await callClient.createCallAgent(tokenCredential, { displayName: 'tester' });
  // teamsMeetingJoinButton.disabled = false;

  //device settings
  deviceManager = await callClient.getDeviceManager();
  await deviceManager.askDevicePermission({ video: true });
  await deviceManager.askDevicePermission({ audio: true });
  console.log("deviceManager", deviceManager)

  const cameras = await deviceManager.getCameras()
  camera = cameras
        ? cameras.length > 0
          ? cameras[0]
          : null
        : null;
  console.log("camera",camera)

  const mics = await deviceManager.getMicrophones();
  mic = mics.length > 0 ? mics[0] : null;
  console.log("mic", mic)
  setInited(true)
}

async function displayLocalVideoStream (LocalVideoStream) {
  try {
      // localVideoStream = new LocalVideoStream(camera)
      localVideoStreamRenderer = new VideoStreamRenderer(localVideoStream);
      const view = await localVideoStreamRenderer.createView();
      if(localVideoContainerRef.current) {
        console.log("append view to local")
        localVideoContainerRef.current.hidden = false;
        localVideoContainerRef.current.appendChild(view.target);
      }
      
  } catch (error) {
      console.error(error);
  } 
}

async function subscribeToCall (call) {
  try {
    // Inspect the initial call.id value.
    console.log(`Call Id: ${call.id}`);
    //Subscribe to call's 'idChanged' event for value changes.
    call.on('idChanged', () => {
        console.log(`Call Id changed: ${call.id}`); 
    });

    call.on('isLocalVideoStartedChanged', () => {
      console.log(`isLocalVideoStarted changed: ${call.isLocalVideoStarted}`);
    });

    // Inspect the call's current remote participants and subscribe to them.
    call.remoteParticipants.forEach(remoteParticipant => {
      subscribeToRemoteParticipant(remoteParticipant);
    });
    // Subscribe to the call's 'remoteParticipantsUpdated' event to be
    // notified when new participants are added to the call or removed from the call.
    call.on('remoteParticipantsUpdated', e => {
        // Subscribe to new remote participants that are added to the call.
        e.added.forEach(remoteParticipant => {
            subscribeToRemoteParticipant(remoteParticipant)
        });
        // Unsubscribe from participants that are removed from the call
        e.removed.forEach(remoteParticipant => {
            console.log('Remote participant removed from the call.');
        });
    });
  }
  catch (error) {
    console.error(error);
  } 
}

const subscribeToRemoteParticipant = (remoteParticipant) => {
  try {
      // Inspect the initial remoteParticipant.state value.
      console.log(`Remote participant state: ${remoteParticipant.state}`);
      // Subscribe to remoteParticipant's 'stateChanged' event for value changes.
      remoteParticipant.on('stateChanged', () => {
          console.log(`Remote participant state changed: ${remoteParticipant.state}`);
      });

      // Inspect the remoteParticipants's current videoStreams and subscribe to them.
      remoteParticipant.videoStreams.forEach(remoteVideoStream => {
        console.log("remoteVideoStream for Each", remoteVideoStream)
        subscribeToRemoteVideoStream(remoteVideoStream)
      });
      // Subscribe to the remoteParticipant's 'videoStreamsUpdated' event to be
      // notified when the remoteParticiapant adds new videoStreams and removes video streams.
      remoteParticipant.on('videoStreamsUpdated', e => {
          // Subscribe to new remote participant's video streams that were added.
          e.added.forEach(remoteVideoStream => {
              console.log("remoteVideoStream", remoteVideoStream)
              subscribeToRemoteVideoStream(remoteVideoStream)
          });
          // Unsubscribe from remote participant's video streams that were removed.
          e.removed.forEach(remoteVideoStream => {
              console.log('Remote participant video stream was removed.');
          })
      });
  } catch (error) {
      console.error(error);
  }
}

const subscribeToRemoteVideoStream = async (remoteVideoStream) => {
  let renderer = new VideoStreamRenderer(remoteVideoStream);
  let view;
  let remoteVideoContainer = document.createElement('div');
  remoteVideoContainer.className = 'remote-video-container';

  remoteVideoStream.on('isReceivingChanged', () => {
      try {
          if (remoteVideoStream.isAvailable) {
            console.log("remoteVideoStream is available")  
            // const isReceiving = remoteVideoStream.isReceiving;
          }
      } catch (e) {
          console.error(e);
      }
  });

  const createView = async () => {
      // Create a renderer view for the remote video stream.
      view = await renderer.createView();
      // Attach the renderer view to the UI.
      console.log("createView for remote")
      remoteVideoContainer.appendChild(view.target);
      remoteVideosGalleryRef.current.appendChild(remoteVideoContainer);
      remoteVideosGalleryRef.current.hidden = false
  }

  // Remote participant has switched video on/off
  remoteVideoStream.on('isAvailableChanged', async () => {
      try {
          if (remoteVideoStream.isAvailable) {
              await createView();
          } else {
              view.dispose();
              remoteVideosGalleryRef.current.removeChild(remoteVideoContainer);
          }
      } catch (e) {
          console.error(e);
      }
  });

  // Remote participant has video on initially.
  if (remoteVideoStream.isAvailable) {
      try {
          await createView();
      } catch (e) {
          console.error(e);
      }
  }
}

async function hangUp() {
  await call.hangUp();
  setJoined(false)
  // hangUpButton.disabled = true;
  // teamsMeetingJoinButton.disabled = false;
  // callStateElement.innerText = '-';
}

async function join() {
  localVideoStream = new LocalVideoStream(camera)
  const videoOptions = { localVideoStreams: [localVideoStream] }
  const audioOptions = {}

  await displayLocalVideoStream(LocalVideoStream)


  call = callAgent.join({ meetingLink: meetingLinkInputRef.current.value }, {
      videoOptions: videoOptions,
      audioOptions: audioOptions
  });

  subscribeToCall(call)
  // call.on('stateChanged', () => {
  //     callStateElement.innerText = call.state;
  // })

  setJoined(true)
  // hangUpButton.disabled = false;
  // teamsMeetingJoinButton.disabled = true;  
}

return (
  <div className="App">
    <h4>Azure Communication Services</h4>
    <h1>Teams meeting join quickstart</h1>
    <input ref={tokenRef} type="text" placeholder="AzureCommunicationToken" />
    {/* <input id="teams-link-input" type="text" placeholder="Teams meeting link" /> */}
    <input ref={meetingLinkInputRef} type="text" placeholder="Teams meeting link" />
    <p>Call state <span id="call-state">-</span></p>
    <p><span id="recording-state"></span></p>
    <div ref={remoteVideosGalleryRef} hidden={true}>Remote participants' video streams:</div>
    <div ref={localVideoContainerRef} hidden={true}>Local video stream:</div>
    {/* <div id="localVideoContainer" hidden={true}>Local video stream:</div> */}
    <div>
        <button id="join-meeting-button" onClick={()=>init()} disabled={inited}>
          Init
        </button>
        {/* <button id="display-local-button" onClick={()=>displayLocalVideoStream()} disabled={!inited}>
          displayLocal
        </button> */}
        <button id="join-meeting-button" onClick={()=>join()} disabled={joined}>
            Join Teams Meeting
        </button>
        <button id="hang-up-button" onClick={()=>hangUp()} disabled={!joined}>
            Hang Up
        </button>
    </div>
  </div>
);
}

export default App;
