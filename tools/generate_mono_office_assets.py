#!/usr/bin/env python3
"""Generate reproducible monochrome Push Office PNG assets (no SVG or font dependencies).

The flat calendar/check and interface symbols follow the Mono Office 10-B design.
Replaces only app-side assets and creates a separate Play Store candidate.
"""
from __future__ import annotations

import argparse
from pathlib import Path
from PIL import Image, ImageDraw

LIGHT = '#F7F8FA'
DARK = '#111315'
CHARCOAL = '#23262B'
SNOW = '#E7E9EC'


def icon_canvas(size: tuple[int, int], background: str | None) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    scale = 3
    bg = background if background else (0, 0, 0, 0)
    image = Image.new('RGBA', (size[0] * scale, size[1] * scale), bg)
    return image, ImageDraw.Draw(image)


def smooth(im: Image.Image, size: tuple[int, int]) -> Image.Image:
    return im.resize(size, Image.Resampling.LANCZOS)


def line(d: ImageDraw.ImageDraw, pts, color, w, scale):
    p = [(round(x * scale), round(y * scale)) for x, y in pts]
    d.line(p, fill=color, width=round(w * scale), joint='curve')
    r = w * scale / 2
    for x, y in (p[0], p[-1]):
        d.ellipse((int(x-r), int(y-r), int(x+r), int(y+r)), fill=color)


def calendar(d, x, y, w, h, color, scale, mode='check'):
    sw = w * .058
    d.rounded_rectangle((int((x+.12*w)*scale), int((y+.185*h)*scale),
                         int((x+.88*w)*scale), int((y+.84*h)*scale)),
                        radius=int(w*.105*scale), outline=color, width=round(sw*scale))
    line(d, [(x+.175*w,y+.355*h),(x+.825*w,y+.355*h)],color,sw*.8,scale)
    for pos in (.34,.66):
        line(d, [(x+pos*w,y+.125*h),(x+pos*w,y+.25*h)],color,sw*.9,scale)
    if mode=='check':
        line(d,[(x+.335*w,y+.605*h),(x+.45*w,y+.70*h),(x+.695*w,y+.49*h)],color,sw*1.12,scale)
    elif mode=='grid':
        for row in range(2):
            for col in range(3):
                cx = (x+(.325+col*.175)*w)*scale
                cy = (y+(.5+row*.17)*h)*scale
                rr=w*.028*scale
                d.rounded_rectangle((int(cx-rr),int(cy-rr),int(cx+rr),int(cy+rr)),radius=round(rr*.3),fill=color)


def bell(d,x,y,w,h,color,scale):
    stroke = w*.056
    # bell dome + shoulders + base and clapper
    line(d,[(x+.21*w,y+.70*h),(x+.31*w,y+.58*h),(x+.31*w,y+.43*h)],color,stroke,scale)
    d.arc((int((x+.31*w)*scale),int((y+.20*h)*scale),int((x+.69*w)*scale),int((y+.67*h)*scale)),180,360,fill=color,width=int(stroke*scale))
    line(d,[(x+.69*w,y+.43*h),(x+.69*w,y+.58*h),(x+.79*w,y+.70*h),(x+.21*w,y+.70*h)],color,stroke,scale)
    d.arc((int((x+.425*w)*scale),int((y+.66*h)*scale),int((x+.575*w)*scale),int((y+.83*h)*scale)),0,180,fill=color,width=int(stroke*scale))


def settings(d,x,y,w,h,color,scale):
    import math
    cx,cy=x+w/2,y+h/2
    points=[]
    for i in range(32):
        a=-math.pi/2+math.pi*i/16
        # Eight wide teeth, clean gear shape
        phase=i%4
        rr=.345*w if phase in (0,1) else .265*w
        points.append((int((cx+rr*math.cos(a))*scale),int((cy+rr*math.sin(a))*scale)))
    d.line(points+[points[0]],fill=color,width=round(.046*w*scale),joint='curve')
    r=.12*w*scale
    d.ellipse((int(cx*scale-r),int(cy*scale-r),int(cx*scale+r),int(cy*scale+r)),outline=color,width=round(.047*w*scale))


def pencil(d,x,y,w,h,color,scale):
    line(d,[(x+.30*w,y+.75*h),(x+.67*w,y+.38*h)],color,w*.070,scale)
    line(d,[(x+.63*w,y+.34*h),(x+.71*w,y+.42*h)],color,w*.045,scale)
    line(d,[(x+.25*w,y+.79*h),(x+.30*w,y+.75*h)],color,w*.04,scale)


def mic(d,x,y,w,h,color,scale):
    d.rounded_rectangle((int((x+.40*w)*scale),int((y+.22*h)*scale),int((x+.60*w)*scale),int((y+.60*h)*scale)),radius=round(.09*w*scale),outline=color,width=round(w*.05*scale))
    d.arc((int((x+.32*w)*scale),int((y+.43*h)*scale),int((x+.68*w)*scale),int((y+.74*h)*scale)),0,180,fill=color,width=round(w*.045*scale))
    line(d,[(x+.5*w,y+.74*h),(x+.5*w,y+.86*h)],color,w*.047,scale)


def draw(kind: str, size: tuple[int,int], color: str, background: str | None=None, padding=.10)->Image.Image:
    im,d=icon_canvas(size,background)
    sc=3
    W,H=size
    if kind in ('mark','icon','adaptive','splash'):
        base=min(W,H)
        factor={'mark':.91,'icon':.76,'adaptive':.55,'splash':.70}[kind]
        ww=base*factor
        calendar(d,(W-ww)/2,(H-ww)/2,ww,ww,color,sc,'check')
    elif kind=='home':
        size1=min(W*.75,H*.99)
        calendar(d,(W-size1)/2,(H-size1)/2,size1,size1,color,sc,'check')
        # calm accent rays, consistent stroke weight
        line(d,[(W*.795,H*.19),(W*.845,H*.14)],color,W*.022,sc)
        line(d,[(W*.87,H*.36),(W*.93,H*.36)],color,W*.022,sc)
    elif kind=='calendar':
        ww=min(W*.78,H*.99)
        calendar(d,(W-ww)/2,(H-ww)/2,ww,ww,color,sc,'grid')
    elif kind=='settings':
        ww=min(W*.86,H*.96)
        settings(d,(W-ww)/2,(H-ww)/2,ww,ww,color,sc)
    elif kind=='notifications':
        ww=min(W*.83,H*.98)
        bell(d,(W-ww)/2,(H-ww)/2,ww,ww,color,sc)
    elif kind=='quick-entry':
        w=min(W*.58,H*.86)
        calendar(d,W*.39-w*.5,(H-w)/2,w,w,color,sc,'check')
        mm=min(W,H)*.33
        mic(d,W*.055,H*.60,mm,mm,color,sc)
        pencil(d,W*.61,H*.34,mm*1.48,mm*1.48,color,sc)
    return smooth(im,size)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
    args=parser.parse_args()
    root=args.root
    out={
      'assets/images/push-office-mark.png':draw('mark',(512,512),CHARCOAL),
      'assets/images/push-office-icon.png':draw('icon',(1024,1024),CHARCOAL,LIGHT),
      'assets/images/push-office-icon-dark.png':draw('icon',(1024,1024),SNOW,DARK),
      'assets/images/push-office-store-icon.png':draw('icon',(512,512),CHARCOAL,LIGHT),
      'assets/images/push-office-adaptive-foreground.png':draw('adaptive',(1024,1024),CHARCOAL),
      'assets/images/push-office-adaptive-monochrome.png':draw('adaptive',(1024,1024),'#FFFFFF'),
      'assets/images/push-office-splash.png':draw('splash',(1024,1024),CHARCOAL),
      'assets/images/push-office-splash-dark.png':draw('splash',(1024,1024),SNOW),
      'assets/images/push-office-favicon.png':draw('icon',(64,64),CHARCOAL,LIGHT),
      'assets/images/illustration-home-mono.png':draw('home',(448,336),CHARCOAL),
      'assets/images/illustration-calendar-mono.png':draw('calendar',(448,336),CHARCOAL),
      'assets/images/illustration-settings-mono.png':draw('settings',(448,336),CHARCOAL),
      'assets/images/illustration-notifications-mono.png':draw('notifications',(448,336),CHARCOAL),
      'assets/images/illustration-quick-entry-mono.png':draw('quick-entry',(448,336),CHARCOAL),
      'modules/push-office-native/android/src/main/res/drawable-nodpi/quick_entry_mono.png':draw('quick-entry',(560,424),CHARCOAL),
      'modules/push-office-native/android/src/main/res/drawable-night/quick_entry_mono.png':draw('quick-entry',(560,424),SNOW),
      'store-assets/ko-KR/app-icon-10b-candidate.png':draw('icon',(512,512),CHARCOAL,LIGHT),
    }
    for name,im in out.items():
        dest=root/name
        dest.parent.mkdir(parents=True,exist_ok=True)
        im.save(dest,optimize=True,compress_level=9)
        print(f'{name} {im.size} {dest.stat().st_size} bytes')

if __name__=='__main__':main()
