"""Render a normal-paced before-and-after film from the extension's browser captures."""
from functools import lru_cache
from pathlib import Path
import subprocess
import tempfile
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

HERE = Path(__file__).resolve().parent
MEDIA = HERE.parents[1] / "docs" / "media"
W, H, FPS = 1600, 900, 30
DURATION = 72
INK, MUTED, PAPER = "#2c2033", "#5f5365", "#f5f2ee"
PLUM, LINE = "#43294f", "#d7cdd5"
# Seconds are wall-clock playback time. Each page stays still on both sides of the wipe.
COMPARISONS = [
    (0, 12, "Campus dashboard", "portal-before", "portal-after",
     "Search across campus services or choose a section in the sidebar."),
    (12, 23, "Student Self-Service", "directory-before", "directory",
     "Find grades, registration, financial aid and billing by name or category."),
    (23, 34, "Registration home", "hub-before", "hub-after",
     "Choose Browse Classes, Plan Ahead or View Registration Information."),
    (34, 46, "Browse Classes", "browse-before", "classes",
     "Find a course by code, title or CRN. Compare meeting times and open seats."),
]
TIMES = [row[0] for row in COMPARISONS] + [46, 59, DURATION]
STAGE = (60, 178, 1540, 779)
RESAMPLE = Image.Resampling.LANCZOS


@lru_cache(None)
def font(size, bold=False):
    options = ["Arial Bold.ttf", "DejaVuSans-Bold.ttf"] if bold else ["Arial.ttf", "DejaVuSans.ttf"]
    for directory in [Path("/System/Library/Fonts/Supplemental"), Path("/usr/share/fonts/truetype/dejavu"), Path("C:/Windows/Fonts")]:
        for name in options:
            if (directory / name).exists():
                return ImageFont.truetype(str(directory / name), size)
    return ImageFont.truetype(options[-1], size)


def write(im, xy, label, size, color=INK, bold=False, anchor="lt"):
    ImageDraw.Draw(im).text(xy, label, font=font(size, bold), fill=color, anchor=anchor)


@lru_cache(None)
def asset(name):
    saved = HERE / "assets" / (name + ".png")
    file = saved if saved.is_file() else HERE / ".frames" / (name + ".png")
    with Image.open(file) as image:
        return image.convert("RGB")


def ease(t):
    t = max(0, min(1, t))
    return t*t*(3-2*t)


def layout(title, caption):
    im = Image.new("RGB", (W, H), PAPER)
    draw = ImageDraw.Draw(im)
    draw.rounded_rectangle((61, 42, 70, 68), radius=4, fill="#ba592a")
    write(im, (83, 43), "iROAR Premium", 25, PLUM, True)
    write(im, (61, 92), title, 56, INK, True)
    draw.line((61, 812, 1539, 812), fill=LINE, width=2)
    write(im, (62, 837), caption, 29)
    return im


def panel(im, rect):
    x, y, right, bottom = rect
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((x, y+4, right, bottom+4), radius=15, fill="#e4dfe3")
    d.rounded_rectangle(rect, radius=15, fill="white", outline=LINE, width=2)


def place(im, source, rect, align=(.5,.5)):
    x, y, right, bottom = rect
    scaled = ImageOps.contain(source, (right-x, bottom-y), method=RESAMPLE)
    im.paste(scaled, (round(x+(right-x-scaled.width)*align[0]), round(y+(bottom-y-scaled.height)*align[1])))


def page_view(name):
    src = asset(name)
    # Frame the first visible rows at readable size, like a stationary browser viewport.
    if name in ("directory-before", "directory", "classes"):
        height = min(src.height, round(src.width * .49))
        src = src.crop((0, 0, src.width, height))
    return src


@lru_cache(None)
def comparison(index, after):
    _, _, title, before_name, after_name, caption = COMPARISONS[index]
    im = layout(title, caption)
    write(im, (1538, 111), "After   /   iROAR Premium" if after else "Before   /   Clemson iROAR",
          26, PLUM if after else MUTED, True, "rt")
    panel(im, STAGE)
    name = after_name if after else before_name
    place(im, page_view(name), (79, 197, 1521, 760))
    return im


def wipe(before, after, fraction):
    if fraction <= 0: return before
    if fraction >= 1: return after
    edge = round(W*fraction)
    im = before.copy()
    im.paste(after.crop((0, 0, edge, H)), (0, 0))
    ImageDraw.Draw(im).line((edge, STAGE[1], edge, STAGE[3]), fill="#d88c55", width=3)
    return im


@lru_cache(None)
def insights():
    im = layout("Instructor ratings and past grades", "Open a course section to check the instructor and explore individual grade reports.")
    write(im, (1538, 51), "Example course section", 22, MUTED, anchor="rt")
    for left, right, name, heading, source_line in [
        (60, 776, "rating", "Rate My Professors", "Student reviews from a matching Clemson profile"),
        (802, 1540, "grades", "Grade distributions", "Published Clemson section history through Spring 2026")
    ]:
        panel(im, (left, 178, right, 779))
        write(im, (left+27, 213), heading, 37, PLUM, True)
        write(im, (left+28, 271), source_line, 22, MUTED)
        ImageDraw.Draw(im).line((left+28, 322, right-28, 322), fill=LINE, width=2)
        place(im, asset(name), (left+34, 354, right-34, 729))
    return im


@lru_cache(None)
def schedule(conflict):
    im = layout("Preview your week", "The preview stays on this page. Use Clemson registration when you’re ready to enroll.")
    write(im, (1538, 51), "Example schedule", 22, MUTED, anchor="rt")
    write(im, (74, 275), "Check for overlaps" if conflict else "Build a weekly preview", 48, PLUM, True)
    lines = (["Adding a section with overlapping times", "shows a conflict before you register."] if conflict else
             ["Add a lecture, lab or weekend section", "to see where it fits in your week."])
    for i, line in enumerate(lines):
        write(im, (77, 359+i*43), line, 31)
    write(im, (78, 561), "Find iROAR Premium in the Chrome Web Store.", 25, MUTED)
    panel(im, (821, 166, 1528, 786))
    # Keep the complete calendar and conflict banner visible; the course list continues below.
    src = asset("conflict" if conflict else "week")
    calendar = src.crop((0, 0, src.width, min(src.height, round(src.width*1.20))))
    place(im, calendar, (842, 185, 1507, 768))
    return im


def scene(index, local):
    if index < len(COMPARISONS):
        return wipe(comparison(index, False), comparison(index, True), ease((local-3.65)/1.55))
    if index == 4: return insights()
    return wipe(schedule(False), schedule(True), ease((local-5.2)/1.35))


def frame(t):
    index = next(i for i in range(len(TIMES)-1) if t < TIMES[i+1])
    local = t-TIMES[index]
    current = scene(index, local)
    if index and local < .5:
        previous = scene(index-1, TIMES[index]-TIMES[index-1])
        current = Image.blend(previous, current, ease(local/.5))
    return current


def score(path):
    rate = 44100
    time = np.arange(rate*DURATION)/rate
    samples = np.zeros_like(time)
    beat = .75
    chords = [(50,57,62,65), (46,53,58,62), (53,60,64,69), (48,55,60,64)]
    def note(start, midi, duration, amplitude):
        offset = round(start*rate)
        count = min(round(duration*rate), len(samples)-offset)
        if count <= 0: return
        t = np.arange(count)/rate
        frequency = 440 * 2**((midi-69)/12)
        envelope = np.minimum(1,t/.05)*np.exp(-1.4*t)*np.minimum(1, (duration-t)/.3)
        samples[offset:offset+count] += amplitude*envelope*(np.sin(2*np.pi*frequency*t)+.1*np.sin(4*np.pi*frequency*t))
    for step in range(round(DURATION/beat)):
        chord = chords[(step//8)%len(chords)]
        if step%4 == 0: note(step*beat,chord[0]-12,3.0,.10)
        if step%2 == 0: note(step*beat,chord[(step//2)%4]+12,2.4,.045)
    samples *= np.minimum(1,time/1.4)*np.minimum(1,(DURATION-time)/2.4)
    with wave.open(str(path),"wb") as f:
        f.setparams((1,2,rate,0,"NONE","not compressed"))
        f.writeframes((samples*32767).astype("<i2").tobytes())


if __name__ == "__main__":
    MEDIA.mkdir(parents=True, exist_ok=True)
    comparison(0, True).save(MEDIA/"showcase-poster.jpg", quality=91, optimize=True)
    with tempfile.TemporaryDirectory() as tmp:
        audio = Path(tmp)/"score.wav"
        score(audio)
        output = MEDIA/"iroar-premium.mp4"
        command = ["ffmpeg","-hide_banner","-loglevel","error","-y","-f","rawvideo","-pix_fmt","rgb24",
                   "-s",f"{W}x{H}","-r",str(FPS),"-i","-","-i",str(audio),"-c:v","libx264","-preset","fast",
                   "-crf","18","-pix_fmt","yuv420p","-c:a","aac","-b:a","96k","-movflags","+faststart",str(output)]
        with subprocess.Popen(command,stdin=subprocess.PIPE) as proc:
            for n in range(DURATION*FPS):
                proc.stdin.write(frame(n/FPS).tobytes())
            proc.stdin.close()
            if proc.wait(): raise RuntimeError("FFmpeg could not encode the showcase")
    print(f"Rendered {output.name} ({DURATION}s)")
