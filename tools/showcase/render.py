"""Compose the iROAR feature film from browser captures and an original synthesized score."""
import math
from functools import lru_cache
from pathlib import Path
import subprocess
import tempfile
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

HERE = Path(__file__).resolve().parent
FRAMES = HERE / ".frames"
MEDIA = HERE.parents[1] / "docs" / "media"
MEDIA.mkdir(parents=True, exist_ok=True)
W, H, FPS = 1600, 900, 24
LENGTH = 38
INK, PAPER, WHITE, PEACH = "#302037", "#f5f1ed", "#fffdf9", "#ffac70"

@lru_cache(None)
def font(size, bold=False, serif=False):
    names = (["Georgia Italic.ttf", "DejaVuSerif-Italic.ttf"] if serif else
             ["Arial Bold.ttf", "DejaVuSans-Bold.ttf"] if bold else ["Arial.ttf", "DejaVuSans.ttf"])
    for name in names:
        for folder in [Path("/System/Library/Fonts/Supplemental"), Path("/usr/share/fonts/truetype/dejavu"), Path("C:/Windows/Fonts")]:
            if (folder / name).exists():
                return ImageFont.truetype(str(folder / name), size)
    return ImageFont.truetype(names[-1], size)

def text(im, xy, label, size, color=INK, bold=False, serif=False):
    ImageDraw.Draw(im).text(xy,label,font=font(size,bold,serif),fill=color,anchor="lt",stroke_width=0)

def ease(x):
    x = max(0,min(1,x))
    return x*x*(3-2*x)

def lerp(a,b,t):
    return round(a+(b-a)*t)

@lru_cache(None)
def backdrop(dark):
    top, bottom = (("#2a1c34","#483052") if dark else ("#fcfaf6","#eee7e8"))
    grad = ImageOps.colorize(Image.linear_gradient("L").resize((W,H)),top,bottom)
    draw = ImageDraw.Draw(grad)
    for k in range(9):
        x=1110+k*50
        draw.line([(x+245,0),(x,450),(x+200,900)], fill="#56395e" if dark else "#e7dcdf",width=2)
    return grad

def header(im, right, dark=False):
    fg = WHITE if dark else INK
    draw = ImageDraw.Draw(im)
    draw.rounded_rectangle((62,39,76,66),radius=5,fill=PEACH if dark else "#b45427")
    text(im,(90,42),"iROAR Premium",24,fg,True)
    draw.text((W-67,43),right,font=font(21),fill=fg,anchor="rt")

@lru_cache(None)
def asset(name):
    folder = HERE / "assets" if name.startswith("hub-") else FRAMES
    return Image.open(folder / (name+".png")).convert("RGB")

def card(im, source, xy, size, crop=None, radius=18, align=(.5,0)):
    source=source.crop(crop) if crop else source
    width,height=size
    screen=ImageOps.fit(source,(width,height),method=Image.Resampling.LANCZOS,centering=align)
    x,y=xy
    mask=Image.new("L",size)
    ImageDraw.Draw(mask).rounded_rectangle((0,0,width-1,height-1),radius,fill=255)
    d=ImageDraw.Draw(im)
    d.rounded_rectangle((x-2,y+7,x+width+2,y+height+10),radius+2,fill="#c7b9c7")
    im.paste(screen,xy,mask)
    d.rounded_rectangle((x,y,x+width-1,y+height-1),radius,outline="#cfc4d1",width=2)

def phone(im, name, x, y, h):
    w=round(h*390/844)
    d=ImageDraw.Draw(im)
    d.rounded_rectangle((x-10,y-10,x+w+10,y+h+10),31,fill="#201825",outline="#8c788e",width=2)
    card(im,asset(name),(x,y),(w,h),radius=21)
    # Place a second bezel over the edge of the capture.
    d.rounded_rectangle((x-3,y-3,x+w+2,y+h+2),23,outline="#201825",width=5)

def scene(index,t):
    dark = index in [0,4,6]
    im=backdrop(dark).copy()
    if index==0:
        header(im,"Clemson student tools",True)
        x=lerp(-25,0,ease(t/.8))
        text(im,(77+x,233),"Registration,",112,WHITE,True)
        text(im,(77+x,366),"reworked.",125,PEACH,serif=True)
        text(im,(84,561),"A tour of iROAR Premium",37,WHITE)
        phone(im,"phone-week",lerp(1140,1095,ease(t/2.4)),124,675)
    elif index==1:
        header(im,"Registration home")
        text(im,(72,100),"The same five destinations.",63,INK,True)
        # A moving cut reveals both versions of the same public Banner menu.
        xy=(73,222); size=(1454,603)
        before=im.copy(); after=im.copy()
        for canvas,name in [(before,"hub-before"),(after,"hub-after")]:
            card(canvas,asset(name),xy,size,align=(.5,0))
        k=ease((t-1.75)/1.85); edge=int(W*k)
        im=before
        if edge: im.paste(after.crop((0,0,edge,H)),(0,0))
        if 0<k<1: ImageDraw.Draw(im).line((edge,213,edge,835),fill="#c25b23",width=5)
        text(im,(76,177),"Original Banner" if k<.5 else "With iROAR Premium",28,"#784520",True)
    elif index==2:
        header(im,"Student directory")
        text(im,(72,110),"Find the service you need.",63,INK,True)
        text(im,(74,196),"Search registration, records, financial aid, and student accounts.",30)
        img=asset("directory")
        card(im,img,(72,lerp(282,258,ease(t/1.6))),(1454,570),crop=(0,0,img.width,470))
    elif index==3:
        header(im,"Browse Classes    /    Example courses")
        text(im,(72,108),"Compare sections.",67,INK,True)
        text(im,(75,198),"Meeting times, instructor ratings, seats, and past grades in one view.",29)
        shot=asset("classes")
        card(im,shot,(70,274),(1460,485),crop=(299,70,1438,450))
        if t>2.5:
            panel=asset("detail")
            y=lerp(910,515,ease((t-2.5)/.8))
            card(im,panel,(517,y),(1005,313),crop=(0,0,panel.width,panel.height),align=(1,0))
    elif index==4:
        header(im,"Schedule preview    /    Example courses",True)
        text(im,(73,240),"See your week",78,WHITE,True)
        text(im,(75,338),"take shape.",88,PEACH,serif=True)
        text(im,(78,505),"Preview lectures, labs, and weekends.",32,WHITE)
        text(im,(78,555),"Overlapping sections get a warning.",32,WHITE)
        sec="week" if t<3.4 else "conflict"
        card(im,asset(sec),(947,112),(520,713),crop=(0,0,470,645))
    elif index==5:
        header(im,"Phone-width layout    /    Example courses")
        text(im,(66,283),"A schedule",71,INK,True)
        text(im,(66,375),"that fits.",85,"#84421e",serif=True)
        text(im,(70,513),"Check a section and preview",30)
        text(im,(70,558),"your week on a narrow screen.",30)
        phone(im,"phone-search",lerp(745,705,ease(t/1.6)),144,659)
        phone(im,"phone-week",lerp(1165,1100,ease((t-.25)/1.5)),125,687)
    else:
        header(im,"Open-source Chrome extension",True)
        text(im,(82,267),"iROAR Premium",104,WHITE,True)
        text(im,(85,448),"Get the extension on GitHub",46,PEACH,serif=True)
        text(im,(87,554),"github.com/Adamruns/iroarpremium",37,WHITE)
    return im

TIMES=[0,3.5,10,14.5,21.5,28.5,34,38]
def frame(t):
    i=next(i for i in range(len(TIMES)-1) if t<TIMES[i+1])
    local=t-TIMES[i]
    im=scene(i,local)
    if i and local<.26:
        prev=scene(i-1,TIMES[i]-TIMES[i-1])
        im=Image.blend(prev,im,ease(local/.26))
    return im

def score(dest):
    rate=44100
    audio=np.zeros(int(rate*LENGTH),dtype=np.float32)
    def note(when,frequency,duration,level,decay):
        offset=round(rate*when)
        n=min(round(rate*duration),len(audio)-offset)
        if n<=0: return
        t=np.arange(n)/rate
        env=np.minimum(1,t/.014)*np.minimum(1,(duration-t)/.12)*np.exp(-decay*t)
        sound=np.sin(2*np.pi*frequency*t)+.18*np.sin(4*np.pi*frequency*t)
        audio[offset:offset+n]+=level*env*sound
    beat=.5
    for step in range(int(LENGTH/beat)):
        chord=[[50,57,62,65],[46,53,58,62],[53,60,64,69],[48,55,60,64]][(step//8)%4]
        hz=lambda midi: 440*2**((midi-69)/12)
        if step%4==0: note(step*beat,hz(chord[0]-12),1.8,.17,1.8)
        note(step*beat,hz(chord[[0,1,2,1,3,2,1,2][step%8]]+12),1.1,.06,4)
        if step%2==1: note(step*beat+.25,hz(chord[2]+12),.7,.025,5)
    audio*=np.minimum(1,np.arange(len(audio))/(rate*.8))*np.minimum(1,np.arange(len(audio))[::-1]/(rate*1.6))
    with wave.open(str(dest),"wb") as f:
        f.setparams((1,2,rate,0,"NONE","not compressed"))
        f.writeframes((audio*30000).astype("<i2").tobytes())

if __name__=="__main__":
    cover=scene(0,2)
    cover.save(MEDIA/"showcase-poster.jpg",quality=89,optimize=True)
    with tempfile.TemporaryDirectory() as tmp:
        audio=Path(tmp)/"score.wav"
        score(audio)
        output=MEDIA/"iroar-premium.mp4"
        cmd=["ffmpeg","-hide_banner","-loglevel","error","-y","-f","rawvideo","-pix_fmt","rgb24","-s",f"{W}x{H}","-r",str(FPS),"-i","-","-i",str(audio),"-c:v","libx264","-preset","fast","-crf","20","-pix_fmt","yuv420p","-c:a","aac","-b:a","96k","-movflags","+faststart",str(output)]
        with subprocess.Popen(cmd,stdin=subprocess.PIPE) as proc:
            for n in range(LENGTH*FPS): proc.stdin.write(frame(n/FPS).tobytes())
            proc.stdin.close()
            if proc.wait(): raise RuntimeError("FFmpeg could not encode the showcase")
    print(f"Rendered {output.name} ({LENGTH}s)")
