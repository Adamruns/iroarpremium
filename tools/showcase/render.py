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
W, H, FPS = 1600, 900, 30
LENGTH = 27
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

def cursor(im, xy, pulse=0):
    x,y=xy
    d=ImageDraw.Draw(im)
    if 0<pulse<1:
        r=round(10+27*pulse)
        d.ellipse((x-r,y-r,x+r,y+r),outline="#b65016",width=max(1,round(5*(1-pulse))))
    d.polygon([(x,y),(x+6,y+30),(x+13,y+21),(x+23,y+19)],fill=INK,outline=WHITE,width=2)

def reveal(before, after, fraction, tilt=80, accent=True):
    if fraction<=0: return before
    if fraction>=1: return after
    edge=lerp(-tilt,W+tilt,fraction)
    mask=Image.new("L",(W,H))
    ImageDraw.Draw(mask).polygon([(0,0),(edge+tilt,0),(edge-tilt,H),(0,H)],fill=255)
    result=Image.composite(after,before,mask)
    if accent:
        ImageDraw.Draw(result).line((edge+tilt,0,edge-tilt,H),fill=PEACH,width=5)
    return result

def directory_shot(name):
    src=asset(name)
    area=Image.new("RGB",(src.width,495),"#faf8fa")
    area.paste(src,(0,0))
    return area

def scene(index,t):
    dark=index in (0,4,6)
    im=backdrop(dark).copy()
    if index==0:
        header(im,"Clemson student tools",True)
        text(im,(lerp(-80,78,ease(t/.48)),235),"Registration,",112,WHITE,True)
        text(im,(lerp(-160,78,ease((t-.12)/.48)),368),"reworked.",125,PEACH,serif=True)
        text(im,(84,lerp(621,556,ease((t-.25)/.48))),"From finding a class to fitting it in.",37,WHITE)
        phone(im,"phone-week",lerp(1475,1070,ease(t/.85)),lerp(197,118,ease(t/1.4)),681)
    elif index==1:
        header(im,"Registration home")
        text(im,(72,105),"Find your next step.",65,INK,True)
        before=im.copy(); after=im.copy()
        for canvas,name,label in [(before,"hub-before","Original Banner"),(after,"hub-after","With iROAR Premium")]:
            text(canvas,(76,189),label,28,"#784520",True)
            card(canvas,asset(name),(73,245),(1454,565),align=(.5,0))
        im=reveal(before,after,ease((t-1)/1.15),tilt=145)
    elif index==2:
        header(im,"Student Self-Service")
        text(im,(72,107),"Go straight to your grades.",62,INK,True)
        text(im,(75,195),"Search across services or filter by category.",30)
        before=im.copy(); after=im.copy()
        for canvas,name in [(before,"directory"),(after,"directory-filter")]:
            card(canvas,directory_shot(name),(72,262),(1454,555))
        im=reveal(before,after,ease((t-1.4)/.36),tilt=0,accent=False)
        pos=ease((t-1.68)/.83)
        cursor(im,(lerp(1110,177,pos),lerp(352,677,pos)),(t-1.19)/.44 if t<1.65 else (t-2.63)/.46)
    elif index==3:
        header(im,"Browse Classes   /   Example courses")
        text(im,(72,105),"Compare your sections.",64,INK,True)
        text(im,(75,196),"Meeting times, open seats, instructor ratings and past grades.",30)
        card(im,asset("classes"),(70,267),(1460,525),crop=(294,86,1429,494))
        if t>1.45:
            y=lerp(930,252,ease((t-1.45)/.55))
            panel=asset("detail")
            # Bring the rating and the complete grade chart into the same close-up.
            card(im,panel,(949,y),(560,557),crop=(690,0,1066,374),align=(1,0))
        if .35<t<1.95:
            k=ease((t-.35)/.75)
            cursor(im,(lerp(908,172,k),lerp(588,753,k)),(t-1.1)/.49)
    elif index==4:
        header(im,"My schedule   /   Example courses",True)
        text(im,(73,240),"See your week",78,WHITE,True)
        text(im,(75,338),"take shape.",88,PEACH,serif=True)
        stages=[(0,"week-0","Start with a lecture."),(.82,"week-1","Add a second section."),(1.55,"week-3","Fit in another course."),(2.27,"week","Check the weekend."),(3.23,"conflict","Spot a time conflict.")]
        idx=max(i for i,(start,_,_) in enumerate(stages) if t>=start)
        start,name,label=stages[idx]
        text(im,(78,505),label,37,WHITE)
        for i in range(len(stages)):
            left=80+i*55
            ImageDraw.Draw(im).rounded_rectangle((left,583,left+42,590),3,fill=PEACH if i<=idx else "#76637c")
        size=(514,710); xy=(940,110); crop=(0,0,470,650)
        card(im,asset(name),xy,size,crop=crop)
        if idx and t-start<.16:
            prev=im.copy()
            card(prev,asset(stages[idx-1][1]),xy,size,crop=crop)
            im=Image.blend(prev,im,ease((t-start)/.16))
    elif index==5:
        header(im,"Phone-width layout   /   Example courses")
        text(im,(66,284),"A schedule",71,INK,True)
        text(im,(66,376),"that fits.",85,"#84421e",serif=True)
        text(im,(70,514),"From class search to",33)
        text(im,(70,560),"your week at a glance.",33)
        phone(im,"phone-search",lerp(908,700,ease(t/.72)),lerp(345,151,ease(t/.72)),655)
        phone(im,"phone-week",lerp(1360,1093,ease((t-.18)/.83)),lerp(422,125,ease((t-.18)/.83)),684)
    else:
        header(im,"Independent Clemson student project",True)
        text(im,(lerp(-90,79,ease(t/.5)),263),"iROAR Premium",104,WHITE,True)
        text(im,(85,436),"Find it in the Chrome Web Store.",49,PEACH,serif=True)
        text(im,(87,554),"adamruns.com/iroarpremium",38,WHITE)
    return im

TIMES=[0,2.6,6.7,10.6,15.6,20.8,24.5,27]
def frame(t):
    i=next(i for i in range(len(TIMES)-1) if t<TIMES[i+1])
    local=t-TIMES[i]
    im=scene(i,local)
    if i and local<.22:
        im=reveal(scene(i-1,TIMES[i]-TIMES[i-1]),im,ease(local/.22),tilt=130)
    d=ImageDraw.Draw(im)
    d.rectangle((0,H-6,W,H),fill="#665269")
    d.rectangle((0,H-6,lerp(0,W,t/LENGTH),H),fill=PEACH)
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
    beat=.4138
    for step in range(int(LENGTH/beat)):
        chord=[[50,57,62,65],[46,53,58,62],[53,60,64,69],[48,55,60,64]][(step//8)%4]
        hz=lambda midi: 440*2**((midi-69)/12)
        if step%4==0: note(step*beat,hz(chord[0]-12),1.8,.17,1.8)
        note(step*beat,hz(chord[[0,1,2,1,3,2,1,2][step%8]]+12),1.1,.06,4)
        if step%2==1: note(step*beat+beat/2,hz(chord[2]+12),.7,.025,5)
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
