# cloverslove

my personal site, [tsundere.vip](https://tsundere.vip/). it's styled like a hyprland desktop shell:
a login greeter, a side bar with workspaces, and tiled glassy windows over a video wallpaper.

## what's in it

- **login greeter** that types a password and logs into the desktop on every visit (click or press a key to speed it up)
- **bar** with workspaces, the focused window's title, a clock that opens the dashboard, and a lock button
- **home**: a fastfetch window, a discord profile card, the spotify player and recently played
- **code**: the github contribution grid, last worked on, and every repo
- **music**: a visualizer, top artists and an album wall built from the listening log
- **links**: an about page styled like neovim, and socials
- **dashboard** that drops down from the top edge with the time, a calendar, birthday countdown and media
- live data from [lanyard](https://github.com/Phineas/lanyard) (discord + spotify), the github api,
  and the listening-log worker in `worker/`

switch workspaces with the bar, keys `1`–`4`, or the scroll wheel. `d` toggles the dashboard.

## files

| file | what it is |
| --- | --- |
| `index.html` / `style.css` / `main.js` | the page, its styles and its behaviour |
| `data.js` | profile info (bio, pronouns, socials, birthday) and the live data fetchers |
| `worker/` | cloudflare worker that logs spotify plays for the recently played list |

the theme comes from one value, `--hue` at the top of `style.css` (158 is mint).

## run it

```bash
npm install
npm run dev
```

run the worker tests with `npm test`, or make a production build with `npm run build`.

## media

| file | used for |
| --- | --- |
| `public/assets/video/rikka.mp4` | the desktop wallpaper (sleeping rikka from chūnibyō, via moewalls) |
| `public/assets/video/rikka-poster.webp` | a still frame, shown behind the login screen and while the video loads |

the video isn't mine; it's here for a non-commercial personal site and belongs to its owners.
swap in your own files with the same names to change it.
