# cloverslove

my personal site. a title-screen style menu over a looping video background, with sections for
about me, my github repos, socials and settings.

## what's in it

- **menu** you can move with the mouse wheel, arrow keys or W/S, and open with click or enter
- **about me** with live discord status and spotify (via [lanyard](https://github.com/Phineas/lanyard)),
  a birthday countdown, and a github contribution grid drawn from data
- **repos** pulled live from the github api; click one to see a summary of its readme
- **socials** and **settings** (music, menu sounds, moving background, less motion)
- menu sound effects are synthesized in the browser (`sfx.js`), no audio files needed

## run it

```bash
npm install
npm run dev
```

run the regression checks with `npm test`, or make a production build with `npm run build`.

## media

| file | used for |
| --- | --- |
| `public/assets/video/rikka-poster.webp` | a frame from the video, shown on the entry screen and when motion is off |
| `public/assets/video/rikka.mp4` | 1080p background on all screens, loaded after entering (sleeping rikka from chūnibyō, via moewalls) |
| `public/assets/video/rikka-4k.mp4` | original 4K copy, kept in the repo but not loaded by the site |
| `public/assets/music/background.mp3` | background music (sabbath, from the saya no uta ost) |

neither is mine; they're here for a non-commercial personal site and belong to their owners.
swap in your own files with the same names to change them.

optional: put your own sound effects in `public/assets/sfx/` and add their paths to
`CUSTOM_FILES` in `sfx.js` (see the readme there). unlisted sounds keep the built-in blips,
so the site never has to guess which files exist.
