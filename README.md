<p align="center">
  <img src="apps/ui/public/logo_black.svg?raw=true" alt="Maintainerr's custom image"/>
</p>

<p align="center" >
<!-- Discord Badge -->  <a href="https://discord.gg/WP4ZW2QYwk"><img alt="Discord" src="https://img.shields.io/discord/1152219249549512724?style=flat&logo=discord&logoColor=white&label=Maintainerr"></a>
<!-- Latest Build -->  <picture><img alt="GitHub Actions Workflow Status" src="https://img.shields.io/github/actions/workflow/status/ydkmlt84/maintainerr/.github%2Fworkflows%2Fbuild.yml?branch=main&style=flat&logo=github&label=Latest%20Build"></picture>
<!-- Latest Release -->  <a href="https://github.com/ydkmlt84/Maintainerr/releases"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/ydkmlt84/maintainerr?style=flat&logo=github&logoColor=white&label=Latest%20Release"></a>
<!-- Commits -->  <picture><img alt="GitHub commits since latest release" src="https://img.shields.io/github/commits-since/ydkmlt84/maintainerr/latest?style=flat&logo=github&logoColor=white"></picture>
<!-- Github Stars -->  <picture><img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/ydkmlt84/maintainerr?style=flat&logo=github&logoColor=white&label=Stars"></picture>
<!-- Docker Pulls -->  <a href="https://hub.docker.com/r/ydkmlt84/maintainerr"><img alt="Docker Pulls" src="https://img.shields.io/docker/pulls/ydkmlt84/maintainerr?style=flat&logo=docker&logoColor=white&label=Docker%20Pulls"></a>
<!--Commits per month -->  <picture><img alt="GitHub commit activity" src="https://img.shields.io/github/commit-activity/m/ydkmlt84/maintainerr?style=flat&logo=github&logoColor=white&label=COMMITS"></picture>
<!-- Issues Closed -->  <picture><img alt="GitHub Issues or Pull Requests" src="https://img.shields.io/github/issues-closed/ydkmlt84/maintainerr?style=flat&logo=github&logoColor=white"></picture>
<!-- Issues Open -->  <picture><img alt="GitHub Issues or Pull Requests" src="https://img.shields.io/github/issues/ydkmlt84/maintainerr?style=flat&logo=github&logoColor=white"></picture>
<!-- License -->  <picture><img alt="GitHub License" src="https://img.shields.io/github/license/ydkmlt84/maintainerr?style=flat"></picture>
</p>

<p><b> ★ THIS FORK WAS CREATED MARCH 24TH, 2026 TO BENCHMARK THE CURRENT STATE OF THE PROJECT, BEFORE THE ADDITION OF ANY NEW AI GENERATED CODE ★</b></p>

<b>Maintainerr</b> makes managing your media easy.

- Do you hate being the janitor of your server?
- Do you have a lot of media that never gets watched?
- Do your users constantly request media, and let it sit there afterward never to be touched again?

If you answered yes to any of those questions... You NEED <b>Maintainerr</b>.
It's a one-stop-shop for handling those outlying shows and movies that take up precious space on your server.

# Features

- Configure rules specific to your needs, based on several available options from Plex, Jellyfin, Seerr, Radarr, Sonarr and Tautulli.
- Switch between Plex and Jellyfin as your media server, with automatic rule migration.
- Manually add media to a collection, in case it's not included after rule execution. (one-off items that don't match a rule set)
- Selectively exclude media from being added to a collection, even if it matches a rule.
- Show a collection, containing rule matched media, on the media server home screen for a specific duration before deletion. Think "Leaving soon".
- Optionally, use a manual collection, in case you don't want <b>Maintainerr</b> to add & remove collections at will.
- Manage media straight from the collection within your media server. <b>Maintainerr</b> will sync and add or exclude media to/from the internal collection.
- Remove or unmonitor media from \*arr
- Clear requests from Seerr
- Delete files from disk

<br />
Currently, <b>Maintainerr</b> supports rule parameters from these apps :

- [Plex](https://www.plex.tv/)
- [Jellyfin](https://jellyfin.org/)
- [Seerr](https://seerr.dev/)
- [Radarr](https://radarr.video/)
- [Sonarr](https://sonarr.tv/)
- [Tautulli](https://tautulli.com/)

# Preview

![image](apps/ui/public/screenshots/overview_screenshot.png)
![image](apps/ui/public/screenshots/rules_screenshot.png)
![image](apps/ui/public/screenshots/collections_screenshot.png)
![image](apps/ui/public/screenshots/rule_example_screenshot.png)

# Installation

Docker images for amd64 & arm64 are available under <b>ghcr.io/ydkmlt84/maintainerr</b> and [ydkmlt84/maintainerr](https://hub.docker.com/r/ydkmlt84/maintainerr). <br />

Data is saved within the container under /opt/data, it is recommended to tie a persistent volume to this location in your docker run command/compose file.
Make sure this directory is read/writeable by the user specified in the 'user' instruction. If no 'user' instruction is configured, the volume should be accessible by UID:GID 1000:1000.

Docker run:

```Yaml
docker run -d \
--name maintainerr \
-e TZ=Europe/Brussels \
-v ./data:/opt/data \
-u 1000:1000 \
-p 6246:6246 \
--restart unless-stopped \
ghcr.io/ydkmlt84/maintainerr:latest
```

Docker-compose:

```Yaml
services:
    maintainerr:
        image: ghcr.io/ydkmlt84/maintainerr:latest # or ydkmlt84/maintainerr:latest
        container_name: maintainerr
        user: 1000:1000
        volumes:
          - type: bind
            source: ./data
            target: /opt/data
        environment:
          - TZ=Europe/Brussels
#      - BASE_PATH=/maintainerr # uncomment if you're serving maintainerr from a subdirectory
#      - UI_HOSTNAME=:: # uncomment if you want to listen on IPv6 instead (default 0.0.0.0)
#      - UI_PORT=6247 # uncomment to change the UI port (default 6246)
#      - GITHUB_TOKEN=ghp_yourtoken # Optional: GitHub Personal Access Token for higher API rate limits (60/hr without, 5000/hr with token)
        ports:
          - 6246:6246
        restart: unless-stopped
```
