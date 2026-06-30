# Static videos

Put fixed course videos in this folder when you want every device to see the same videos without a VPS or cloud storage backend.

Example files currently referenced by the app:

- `sample1.mp4`
- `sample2.mp4`
- `sample3.mp4`

After adding or renaming videos, update:

```txt
src/data/staticVideos.ts
```

Notes:

- Keep each video under 50 MiB when committing normal Git files.
- Files over 25 MiB are easier to upload with local Git commands instead of the GitHub web uploader.
- The parent upload page still saves videos to the current browser only. Static videos are managed by GitHub commits.
