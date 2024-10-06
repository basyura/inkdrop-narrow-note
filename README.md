# narrow-note

Quickly narrow down and open note.  

![Screenshot](https://raw.githubusercontent.com/basyura/inkdrop-narrow-note/master/images/image.png)

To use Migemo, set the file path of the dictionary.

![Screenshot](https://raw.githubusercontent.com/basyura/inkdrop-narrow-note/master/images/migemo.png)

Narrow down with multiple words.

![Screenshot](https://raw.githubusercontent.com/basyura/inkdrop-narrow-note/master/images/multi_word.png)


## Install

```
ipm install narrow-note
```

## Commands

| Command                    | Explanation        |
| -------------------------- | -------------------|
| narrow-note:open           | Open note selector |
| narrow-note:openOnlyInBook | Open note selector with only notes from the editing note's book |

## Settings

| key                  | default  | Explanation                                                |
| ---------------------| -------- | -----------------------------------------------------------|
| migemoDictPath       |          | migemo ditionary file path. ex)  C:/js/migemo-compact-dict |
| defaultDisplayNumber | 10       | default display number                                     |
| limit                | 2000     | The limit on the number of notes to be searched            |

## Maintenance Commands

cmd.rebuild
* "narrow-note" caches a list of notes for performance. It recreates the cache when a new note is created. Changing the name of a note does not recreate the cache. This is performed to recreate the cache in such cases.


![Maintenance Commands ](https://raw.githubusercontent.com/basyura/inkdrop-narrow-note/master/images/maintenance_cmds.png)

## LICENSE

MIT

## Thanks

This project's original is https://github.com/heathyboyj/inkdrop-switch-note.
