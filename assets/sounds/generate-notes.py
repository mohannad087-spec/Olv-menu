import numpy as np, subprocess, sys
SR=44100  # شغّله من مجلد الأصوات: python3 generate-notes.py
rng=np.random.default_rng(7)
# short room-ish tail
n=int(SR*.7);t=np.arange(n)/SR
IR=rng.standard_normal(n)*np.exp(-t*7);IR[0]=0;IR/=np.abs(IR).sum()
def note(f,dur=.9,vel=1.0,bright=1.0):
    t=np.arange(int(SR*dur))/SR
    # kalimba/marimba-like: fundamental + inharmonic tine partials with faster decay
    y=np.sin(2*np.pi*f*t)*np.exp(-t*5.0)
    y+=.28*np.sin(2*np.pi*f*2.0*t)*np.exp(-t*8)
    y+=.16*bright*np.sin(2*np.pi*f*5.4*t)*np.exp(-t*28)   # tine "ping"
    y+=.05*bright*np.sin(2*np.pi*f*9.6*t)*np.exp(-t*45)
    a=np.minimum(1,t/.004);y*=a                              # 4ms attack
    return y*vel
def seq(notes,total):
    out=np.zeros(int(SR*total))
    for st,f,vel,dur in notes:
        y=note(f,dur,vel);i=int(st*SR);out[i:i+len(y)]+=y[:len(out)-i]
    return out
def finish(y,name,wet=.22,peak=.5,tail=.05):
    w=np.convolve(y,IR)[:len(y)]
    y=y+wet*w*6
    y=y[:int(SR*(len(y)/SR))]
    # fade end
    k=int(SR*.12);y[-k:]*=np.linspace(1,0,k)
    y=y/np.abs(y).max()*peak
    pcm=(y*32767).astype('<i2').tobytes()
    subprocess.run(['ffmpeg','-v','error','-y','-f','s16le','-ar',str(SR),'-ac','1','-i','-','-c:a','libmp3lame','-b:a','80k',name+'.mp3'],input=pcm,check=True)
# C major pentatonic
C5,D5,E5,G5,A5,C6,D6,E6,G6=523.25,587.33,659.25,783.99,880.0,1046.5,1174.66,1318.51,1567.98
A4,G4=440.0,392.0
# taps: single soft notes, 5 variants
for i,f in enumerate([E5,G5,A5,C6,D5],1):
    finish(seq([(0,f,1,.6)],.6),f'tap-{i}',wet=.15)
finish(seq([(0,G5,.9,.5),(.07,C6,.8,.6)],.7),'toggle-on')
finish(seq([(0,C6,.8,.5),(.07,G5,.7,.6)],.7),'toggle-off')
finish(seq([(0,G5,.8,.6),(.09,C6,.9,.7)],.9),'open',wet=.28)
finish(seq([(0,C6,.7,.6),(.09,G5,.8,.7)],.9),'close',wet=.28)
finish(seq([(0,E5,.9,.6),(.08,A5,.9,.7)],.9),'select')
finish(seq([(0,C5,.9,.6),(.09,E5,.9,.6),(.18,G5,1,.9)],1.1),'add',wet=.25)
finish(seq([(0,G5,.9,.5),(.09,E5,.8,.6)],.8),'remove',wet=.18)
finish(seq([(0,C5,.9,.8),(.14,G5,.9,.9),(.28,E6,1,1.1)],1.4),'chime',wet=.3)
finish(seq([(0,C5,.9,1),(.11,E5,.9,1),(.22,G5,.9,1),(.33,C6,1,1.1),(.46,E6,1,1.4)],1.9),'celebrate',wet=.32)
