Drop your own sound files here to replace the built-in (synthesized) UI sounds.
Then list each file in CUSTOM_FILES near the top of sfx.js. Files are not discovered automatically.

Sound names:

  hover   - moving over a button / changing the menu selection
  select  - clicking a button or link
  open    - opening a section from the main menu
  back    - returning to the main menu
  toggle  - sub-tabs and settings switches
  catch   - catching a three-leaf clover
  lucky   - catching a four-leaf clover

Example (.mp3, .wav or .ogg):

  const CUSTOM_FILES = {
    hover: "/assets/sfx/hover.wav",
    open: "/assets/sfx/open.mp3",
  };

Unlisted sounds, or files that fail to load, keep the built-in version.
The default empty map makes no sound-file requests. Reload after changing files or the map.
