// TeleMeet – Enterprise Video Conferencing
const $ = id => document.getElementById(id);
const joinScreen=$('join-screen'), meetingUI=$('meeting-ui'), joinBtn=$('join-btn');
const usernameInput=$('username-input'), roomInput=$('room-input'), pinInput=$('pin-input');
const hostCheckbox=$('host-checkbox'), localVideo=$('local-video'), localLabel=$('local-label');
const videoGrid=$('video-grid'), muteBtn=$('mute-btn'), videoBtn=$('video-btn');
const shareBtn=$('share-btn'), chatBtn=$('chat-btn'), tpToggleBtn=$('tp-toggle-btn');
const leaveBtn=$('leave-btn'), inviteBtn=$('invite-btn'), handBtn=$('hand-btn');
const reactBtn=$('react-btn'), pollBtn=$('poll-btn'), fullscreenBtn=$('fullscreen-btn');
const teleprompter=$('teleprompter'), tpText=$('teleprompter-text');
const tpScrollBtn=$('tp-scroll-btn'), tpSpeedLabel=$('tp-speed-label');
const chatSidebar=$('chat-sidebar'), chatInput=$('chat-msg-input'), chatMsgs=$('chat-messages');
const roomNameDisplay=$('room-name-display'), participantCount=$('participant-count');
const waitingRoom=$('waiting-room'), reactionBar=$('reaction-bar');

let ws, localStream, peerConnections={}, screenStream=null;
let isHost=false, isModerator=false, canShare=false;
let audioMuted=true, videoMuted=false, handRaised=false;
let myUsername='', myRoom='', participantsList=[], meetingStartTime=null, timerInterval=null;

const config={iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]};

// --- Sounds ---
function playSound(type){
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    if(type==='join'){o.frequency.value=800;g.gain.value=0.1;o.start();o.stop(ctx.currentTime+0.15);}
    else if(type==='leave'){o.frequency.value=400;g.gain.value=0.1;o.start();o.stop(ctx.currentTime+0.2);}
    else if(type==='hand'){o.frequency.value=600;g.gain.value=0.08;o.start();o.stop(ctx.currentTime+0.1);
        setTimeout(()=>{const o2=ctx.createOscillator(),g2=ctx.createGain();o2.connect(g2);g2.connect(ctx.destination);
        o2.frequency.value=900;g2.gain.value=0.08;o2.start();o2.stop(ctx.currentTime+0.1);},120);}
}

// --- Toast ---
function showToast(msg,dur=3000){
    const t=$('toast');t.innerText=msg;t.classList.remove('hidden');t.classList.add('show');
    setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.classList.add('hidden'),300);},dur);
}

// --- Timer ---
function startTimer(){
    meetingStartTime=Date.now();
    timerInterval=setInterval(()=>{
        const d=Date.now()-meetingStartTime, s=Math.floor(d/1000);
        const h=String(Math.floor(s/3600)).padStart(2,'0');
        const m=String(Math.floor((s%3600)/60)).padStart(2,'0');
        const sc=String(s%60).padStart(2,'0');
        $('meeting-timer').innerText=`${h}:${m}:${sc}`;
    },1000);
}

// --- Floating Reactions ---
function spawnReaction(emoji){
    const c=$('reaction-container'), el=document.createElement('div');
    el.className='floating-emoji'; el.innerText=emoji;
    el.style.left=Math.random()*250+'px';
    c.appendChild(el); setTimeout(()=>el.remove(),2600);
}

// --- Invite Link ---
const urlParams=new URLSearchParams(window.location.search);
const inviteRoom=urlParams.get('room');
if(inviteRoom){roomInput.value=inviteRoom;roomInput.readOnly=true;$('host-label').style.display='none';hostCheckbox.checked=false;}

// --- Participant Count ---
function updateParticipantCount(){participantCount.innerText=`${participantsList.length+1} Teilnehmer`;}

// --- Role UI ---
function updateRoleUI(){
    if(isHost){muteBtn.style.display='flex';shareBtn.style.display='flex';tpToggleBtn.classList.remove('hidden');pollBtn.classList.remove('hidden');canShare=true;return;}
    if(isModerator){shareBtn.style.display=canShare?'flex':'none';pollBtn.classList.remove('hidden');return;}
    muteBtn.style.display='none';shareBtn.style.display='none';
}
function updateMuteUI(){
    muteBtn.classList.toggle('off',audioMuted);
    muteBtn.querySelector('i').setAttribute('data-lucide',audioMuted?'mic-off':'mic');
    muteBtn.querySelector('span').innerText=audioMuted?'Stumm':'Aktiv';lucide.createIcons();
}

// --- Media ---
async function startLocalMedia(){
    try{
        if(isHost){localStream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});localVideo.srcObject=localStream;localStream.getAudioTracks().forEach(t=>t.enabled=false);audioMuted=true;updateMuteUI();}
        else{localStream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});localVideo.srcObject=localStream;audioMuted=true;}
    }catch(e){
        try{localStream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});localVideo.srcObject=localStream;audioMuted=true;muteBtn.style.display='none';showToast("Nur Video verfügbar.");}
        catch(e2){alert("Kamera nicht verfügbar.");return false;}
    }
    return true;
}

// --- Join ---
joinBtn.addEventListener('click',async()=>{
    myUsername=usernameInput.value.trim();myRoom=roomInput.value.trim();const pin=pinInput.value.trim();isHost=hostCheckbox.checked;
    if(!myUsername||!myRoom||!pin)return alert("Bitte alle Felder ausfüllen.");
    joinBtn.disabled=true;joinBtn.innerText="Verbinde...";
    const ok=await startLocalMedia();if(!ok||!localStream){joinBtn.disabled=false;joinBtn.innerText="Meeting beitreten";return;}
    localLabel.innerText=`${myUsername} ${isHost?'👑 Host':''}`;roomNameDisplay.innerText=`Raum: ${myRoom}`;
    updateRoleUI();connectSignaling(pin);
});

$('leave-waiting-btn').addEventListener('click',()=>location.reload());

// --- Signaling ---
function connectSignaling(pin){
    let wsUrl;
    if(location.hostname==='localhost'||location.hostname==='127.0.0.1')wsUrl=`ws://${location.hostname}:8002`;
    else{const p=location.protocol==='https:'?'wss:':'ws:';wsUrl=`${p}//${location.host}/ws-telemeet`;}
    ws=new WebSocket(wsUrl);
    ws.onopen=()=>{ws.send(JSON.stringify({action:"join",room_id:myRoom,username:myUsername,is_host:isHost,pin}));};
    ws.onclose=()=>showToast("Verbindung verloren.");
    ws.onerror=()=>showToast("WebSocket Fehler.");
    ws.onmessage=async(ev)=>{
        const d=JSON.parse(ev.data);
        switch(d.action){
        case "error":alert(d.message);location.reload();break;
        case "waiting-room":
            joinScreen.style.display='none';waitingRoom.classList.remove('hidden');break;
        case "admitted":
            waitingRoom.classList.add('hidden');meetingUI.style.display='flex';lucide.createIcons();startTimer();updateParticipantCount();showToast("Du wurdest zugelassen!");playSound('join');
            for(let u of d.users){participantsList.push(u.username);createPeerConnection(u.username,true);}
            updateParticipantCount();break;
        case "rejected":
            alert("Du wurdest vom Host abgelehnt.");location.reload();break;
        case "room-info":
            joinScreen.style.display='none';meetingUI.style.display='flex';lucide.createIcons();startTimer();
            for(let u of d.users){participantsList.push(u.username);createPeerConnection(u.username,true);}
            updateParticipantCount();break;
        case "user-joined":
            participantsList.push(d.username);updateParticipantCount();showToast(`${d.username} ist beigetreten.`);playSound('join');createPeerConnection(d.username,false);updateParticipantsPanel();break;
        case "user-left":
            participantsList=participantsList.filter(u=>u!==d.username);updateParticipantCount();showToast(`${d.username} hat verlassen.`);playSound('leave');
            if(peerConnections[d.username]){peerConnections[d.username].close();delete peerConnections[d.username];}
            const v=$(`video-container-${d.username}`);if(v)v.remove();updateParticipantsPanel();break;
        case "pending-user":
            showToast(`🚪 ${d.username} wartet im Wartezimmer.`);playSound('hand');
            $('pending-section').classList.remove('hidden');
            const pl=$('pending-list'),pi=document.createElement('div');pi.className='pending-item';pi.id=`pending-${d.username}`;
            pi.innerHTML=`<span>${d.username}</span><div class="pending-actions"><button class="admit-btn" onclick="admitUser('${d.username}')">✓</button><button class="reject-btn" onclick="rejectUser('${d.username}')">✗</button></div>`;
            pl.appendChild(pi);break;
        case "offer":if(d.target===myUsername)await handleOffer(d.offer,d.sender);break;
        case "answer":if(d.target===myUsername&&peerConnections[d.sender])await peerConnections[d.sender].setRemoteDescription(new RTCSessionDescription(d.answer));break;
        case "ice-candidate":if(d.target===myUsername&&peerConnections[d.sender])try{await peerConnections[d.sender].addIceCandidate(new RTCIceCandidate(d.candidate));}catch(e){}break;
        case "chat":addChatMessage(d.username,d.message);break;
        case "kicked":alert("Du wurdest entfernt.");if(ws)ws.close();location.reload();break;
        case "unmute-request":
            try{const as=await navigator.mediaDevices.getUserMedia({audio:true});const at=as.getAudioTracks()[0];localStream.addTrack(at);
            for(let u in peerConnections)peerConnections[u].addTrack(at,localStream);
            audioMuted=false;muteBtn.style.display='flex';updateMuteUI();showToast("🎙️ Mikrofon freigeschaltet!");addChatMessage("System","Dein Mikrofon wurde freigeschaltet.");}
            catch(e){showToast("Mikrofon nicht verfügbar.");}break;
        case "promoted-moderator":
            isModerator=true;canShare=true;localLabel.innerText=`${myUsername} 🛡️ Mod`;shareBtn.style.display='flex';pollBtn.classList.remove('hidden');
            showToast("🛡️ Du bist jetzt Moderator!");for(let u of participantsList)addModeratorButtons(u);break;
        case "role-changed":
            const rc=$(`video-container-${d.username}`);if(rc){const lb=rc.querySelector('.video-label');if(lb)lb.childNodes[0].textContent=`${d.username} 🛡️ `;}
            showToast(`${d.username} ist Moderator.`);break;
        case "screen-share-granted":canShare=true;shareBtn.style.display='flex';showToast("💻 Bildschirmfreigabe erlaubt!");break;
        case "screen-share-revoked":canShare=false;shareBtn.style.display='none';if(screenStream)stopScreenShare();showToast("Bildschirmfreigabe entzogen.");break;
        case "hand-raised":
            showToast(`✋ ${d.username} hebt die Hand!`);playSound('hand');
            const hc=$(`video-container-${d.username}`);if(hc&&!hc.querySelector('.hand-badge')){const hb=document.createElement('div');hb.className='hand-badge';hb.innerText='✋';hc.appendChild(hb);}break;
        case "hand-lowered":
            const hlc=$(`video-container-${d.username}`);if(hlc){const hb=hlc.querySelector('.hand-badge');if(hb)hb.remove();}break;
        case "reaction":spawnReaction(d.emoji);break;
        case "new-poll":showPoll(d);break;
        case "poll-update":updatePollResults(d);break;
        case "poll-closed":showToast("Umfrage beendet.");break;
        }
    };
}

// --- Waiting Room ---
window.admitUser=function(u){ws.send(JSON.stringify({action:'admit-user',target:u}));const el=$(`pending-${u}`);if(el)el.remove();};
window.rejectUser=function(u){ws.send(JSON.stringify({action:'reject-user',target:u}));const el=$(`pending-${u}`);if(el)el.remove();};

// --- Moderator Buttons ---
function addModeratorButtons(remoteUsername){
    const c=$(`video-container-${remoteUsername}`);if(!c)return;
    const l=c.querySelector('.video-label');if(!l||l.querySelector('.host-action-btn'))return;
    const ub=document.createElement('button');ub.innerText='🎙️';ub.title='Unmute';ub.className='host-action-btn unmute-action';
    ub.onclick=()=>{ws.send(JSON.stringify({action:'unmute',target:remoteUsername}));ub.innerText='🎙️✓';ub.classList.add('active');};l.appendChild(ub);
    const gb=document.createElement('button');gb.innerText='💻';gb.title='Screen Share';gb.className='host-action-btn share-grant-action';
    gb.onclick=()=>{ws.send(JSON.stringify({action:'grant-screen-share',target:remoteUsername}));gb.innerText='💻✓';gb.classList.add('active');};l.appendChild(gb);
}

// --- WebRTC ---
function createPeerConnection(ru,init){
    if(peerConnections[ru])return peerConnections[ru];
    const pc=new RTCPeerConnection(config);peerConnections[ru]=pc;
    localStream.getTracks().forEach(t=>pc.addTrack(t,localStream));
    pc.onicecandidate=e=>{if(e.candidate&&ws&&ws.readyState===1)ws.send(JSON.stringify({action:"ice-candidate",sender:myUsername,target:ru,candidate:e.candidate}));};
    pc.ontrack=e=>{
        let rc=$(`video-container-${ru}`),rv;
        if(!rc){
            rc=document.createElement('div');rc.className='video-container';rc.id=`video-container-${ru}`;
            rv=document.createElement('video');rv.autoplay=true;rv.playsInline=true;
            const lb=document.createElement('div');lb.className='video-label';lb.innerText=ru+' ';
            if(isHost||isModerator){
                const ub=document.createElement('button');ub.innerText='🎙️';ub.className='host-action-btn unmute-action';
                ub.onclick=()=>{ws.send(JSON.stringify({action:'unmute',target:ru}));ub.innerText='🎙️✓';ub.classList.add('active');};lb.appendChild(ub);
                const gb=document.createElement('button');gb.innerText='💻';gb.className='host-action-btn share-grant-action';
                gb.onclick=()=>{ws.send(JSON.stringify({action:'grant-screen-share',target:ru}));gb.innerText='💻✓';gb.classList.add('active');};lb.appendChild(gb);
            }
            if(isHost){
                const mb=document.createElement('button');mb.innerText='🛡️';mb.className='host-action-btn mod-action';
                mb.onclick=()=>{ws.send(JSON.stringify({action:'promote-moderator',target:ru}));mb.innerText='🛡️✓';mb.classList.add('active');mb.disabled=true;};lb.appendChild(mb);
                const kb=document.createElement('button');kb.innerText='🚫';kb.className='host-action-btn kick-action';
                kb.onclick=()=>{if(confirm(`${ru} entfernen?`))ws.send(JSON.stringify({action:'kick',target:ru}));};lb.appendChild(kb);
            }
            rc.appendChild(rv);rc.appendChild(lb);videoGrid.appendChild(rc);
        }else rv=rc.querySelector('video');
        rv.srcObject=e.streams[0];
    };
    if(init){pc.createOffer().then(o=>pc.setLocalDescription(o)).then(()=>ws.send(JSON.stringify({action:"offer",sender:myUsername,target:ru,offer:pc.localDescription}))).catch(e=>console.error(e));}
    return pc;
}
async function handleOffer(offer,sender){
    const pc=createPeerConnection(sender,false);await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const a=await pc.createAnswer();await pc.setLocalDescription(a);
    ws.send(JSON.stringify({action:"answer",sender:myUsername,target:sender,answer:pc.localDescription}));
}

// --- Controls ---
muteBtn.addEventListener('click',()=>{const t=localStream.getAudioTracks();if(!t.length){showToast("Kein Mikrofon.");return;}audioMuted=!audioMuted;t.forEach(t=>t.enabled=!audioMuted);updateMuteUI();});
videoBtn.addEventListener('click',()=>{const t=localStream.getVideoTracks();if(!t.length)return;videoMuted=!videoMuted;t[0].enabled=!videoMuted;videoBtn.classList.toggle('off',videoMuted);videoBtn.querySelector('i').setAttribute('data-lucide',videoMuted?'video-off':'video');lucide.createIcons();});

shareBtn.addEventListener('click',async()=>{
    if(!canShare&&!isHost){showToast("Keine Berechtigung.");return;}
    if(!screenStream){try{screenStream=await navigator.mediaDevices.getDisplayMedia({video:true});const st=screenStream.getVideoTracks()[0];
    for(let u in peerConnections){const s=peerConnections[u].getSenders().find(s=>s.track&&s.track.kind==='video');if(s)s.replaceTrack(st);}
    localVideo.srcObject=screenStream;shareBtn.classList.add('off');shareBtn.querySelector('i').setAttribute('data-lucide','monitor-x');lucide.createIcons();showToast("Bildschirmfreigabe aktiv.");st.onended=stopScreenShare;}catch(e){}}
    else stopScreenShare();
});
function stopScreenShare(){if(screenStream){screenStream.getTracks().forEach(t=>t.stop());screenStream=null;}const ct=localStream.getVideoTracks()[0];for(let u in peerConnections){const s=peerConnections[u].getSenders().find(s=>s.track&&s.track.kind==='video');if(s&&ct)s.replaceTrack(ct);}localVideo.srcObject=localStream;shareBtn.classList.remove('off');shareBtn.querySelector('i').setAttribute('data-lucide','monitor-up');lucide.createIcons();showToast("Freigabe beendet.");}

// Hand raise
handBtn.addEventListener('click',()=>{handRaised=!handRaised;handBtn.classList.toggle('active',handRaised);
    if(handRaised){ws.send(JSON.stringify({action:'hand-raise'}));showToast("✋ Hand gehoben");const lb=$('local-video-container');if(!lb.querySelector('.hand-badge')){const hb=document.createElement('div');hb.className='hand-badge';hb.innerText='✋';lb.appendChild(hb);}}
    else{ws.send(JSON.stringify({action:'hand-lower'}));const hb=$('local-video-container').querySelector('.hand-badge');if(hb)hb.remove();}
});

// Reactions
reactBtn.addEventListener('click',()=>{reactionBar.style.display=reactionBar.style.display==='flex'?'none':'flex';});
document.querySelectorAll('.reaction-emoji').forEach(b=>{b.addEventListener('click',()=>{const e=b.dataset.emoji;ws.send(JSON.stringify({action:'reaction',emoji:e}));spawnReaction(e);reactionBar.style.display='none';});});

// Fullscreen
fullscreenBtn.addEventListener('click',()=>{if(!document.fullscreenElement)document.documentElement.requestFullscreen();else document.exitFullscreen();});

leaveBtn.addEventListener('click',()=>{if(confirm("Meeting verlassen?")){for(let u in peerConnections)peerConnections[u].close();if(localStream)localStream.getTracks().forEach(t=>t.stop());if(ws)ws.close();location.reload();}});
chatBtn.addEventListener('click',()=>{chatSidebar.style.display=chatSidebar.style.display==='flex'?'none':'flex';});
$('chat-close-btn').addEventListener('click',()=>{chatSidebar.style.display='none';});
inviteBtn.addEventListener('click',()=>{const u=`${location.origin}/telemeet/?room=${encodeURIComponent(myRoom)}`;navigator.clipboard.writeText(u).then(()=>showToast("Link kopiert! 📋")).catch(()=>prompt("Link:",u));});

// Participants panel
participantCount.addEventListener('click',()=>{const p=$('participants-panel');p.style.display=p.style.display==='flex'?'none':'flex';updateParticipantsPanel();});
$('participants-close-btn').addEventListener('click',()=>{$('participants-panel').style.display='none';});
function updateParticipantsPanel(){
    const pl=$('participants-list');pl.innerHTML='';
    const me=document.createElement('div');me.className='participant-item';
    me.innerHTML=`<span>${myUsername} (Du) <span class="participant-role">${isHost?'👑 Host':isModerator?'🛡️ Mod':'👤 Gast'}</span></span>`;pl.appendChild(me);
    for(let u of participantsList){const pi=document.createElement('div');pi.className='participant-item';pi.innerHTML=`<span>${u} <span class="participant-role">👤</span></span>`;pl.appendChild(pi);}
}

// --- Teleprompter ---
tpToggleBtn.addEventListener('click',()=>{teleprompter.style.display=teleprompter.style.display==='block'?'none':'block';});
let scrolling=false,scrollInterval,scrollSpeed=50;
tpScrollBtn.addEventListener('click',()=>{scrolling=!scrolling;tpScrollBtn.innerText=scrolling?'⏸':'▶';clearInterval(scrollInterval);if(scrolling)scrollInterval=setInterval(()=>{tpText.scrollTop+=1;},scrollSpeed);});
$('tp-speed-up').addEventListener('click',()=>{scrollSpeed=Math.max(10,scrollSpeed-10);tpSpeedLabel.innerText=scrollSpeed+'ms';if(scrolling){clearInterval(scrollInterval);scrollInterval=setInterval(()=>{tpText.scrollTop+=1;},scrollSpeed);}});
$('tp-speed-down').addEventListener('click',()=>{scrollSpeed=Math.min(200,scrollSpeed+10);tpSpeedLabel.innerText=scrollSpeed+'ms';if(scrolling){clearInterval(scrollInterval);scrollInterval=setInterval(()=>{tpText.scrollTop+=1;},scrollSpeed);}});

// --- Polls ---
pollBtn.addEventListener('click',()=>{const p=$('poll-panel');p.style.display=p.style.display==='flex'?'none':'flex';if(p.style.display==='flex'&&(isHost||isModerator))showPollCreator();});
$('poll-close-btn').addEventListener('click',()=>{$('poll-panel').style.display='none';});
function showPollCreator(){
    const pc=$('poll-content');
    pc.innerHTML=`<div class="poll-create"><input type="text" id="poll-q" placeholder="Frage eingeben..."><input type="text" id="poll-o1" placeholder="Option 1"><input type="text" id="poll-o2" placeholder="Option 2"><input type="text" id="poll-o3" placeholder="Option 3 (optional)"><button onclick="createPoll()">Umfrage starten</button></div>`;
}
window.createPoll=function(){
    const q=$('poll-q').value.trim();const opts=[$('poll-o1').value.trim(),$('poll-o2').value.trim(),$('poll-o3')?.value.trim()].filter(o=>o);
    if(!q||opts.length<2){showToast("Frage + mindestens 2 Optionen nötig.");return;}
    ws.send(JSON.stringify({action:'create-poll',question:q,options:opts}));$('poll-panel').style.display='none';showToast("Umfrage gestartet!");
};
function showPoll(d){
    const pp=$('poll-panel');pp.style.display='flex';const pc=$('poll-content');
    pc.innerHTML=`<div class="poll-question">${escapeHtml(d.question)}</div>`;
    d.options.forEach((o,i)=>{const opt=document.createElement('div');opt.className='poll-option';opt.innerHTML=`<span>${escapeHtml(o)}</span><span class="poll-percent" id="poll-${d.poll_id}-pct-${i}">0%</span>`;
    opt.onclick=()=>{ws.send(JSON.stringify({action:'vote-poll',poll_id:d.poll_id,option:i}));document.querySelectorAll('.poll-option').forEach(e=>e.classList.remove('voted'));opt.classList.add('voted');};
    pc.appendChild(opt);});
    showToast("📊 Neue Umfrage!");
}
function updatePollResults(d){
    d.results.forEach((count,i)=>{const el=$(`poll-${d.poll_id}-pct-${i}`);if(el){const pct=d.total?Math.round(count/d.total*100):0;el.innerText=`${pct}% (${count})`;}});
}

// --- Chat ---
$('send-chat-btn').addEventListener('click',sendChat);
chatInput.addEventListener('keypress',e=>{if(e.key==='Enter')sendChat();});
function sendChat(){const m=chatInput.value.trim();if(!m||!ws||ws.readyState!==1)return;ws.send(JSON.stringify({action:"chat",message:m}));addChatMessage("Du",m);chatInput.value='';}
function addChatMessage(u,m){const d=document.createElement('div');d.className='chat-msg';const t=new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});d.innerHTML=`<strong>${u} <span class="chat-time">${t}</span></strong>${escapeHtml(m)}`;chatMsgs.appendChild(d);chatMsgs.scrollTop=chatMsgs.scrollHeight;}
function escapeHtml(t){const d=document.createElement('div');d.textContent=t;return d.innerHTML;}
