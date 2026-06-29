# Caching Strategy

## Philosophy

Bandwidth is expensive.

Latency is expensive.

Repeated work is expensive.

The browser already contains powerful caching mechanisms capable of eliminating the overwhelming majority of requests made to the server.

This project is designed around one simple rule:

> Every byte downloaded should be reused as many times as possible.

The browser should become the primary execution environment, while GitHub, Cloudflare, and R2 act primarily as static content distributors.

---

# Primary Goals

The caching system exists to accomplish several objectives.

* Reduce requests to origin servers.
* Maximize Cloudflare cache utilization.
* Eliminate unnecessary downloads.
* Reduce page load time.
* Improve reader responsiveness.
* Lower infrastructure costs.
* Scale without requiring additional application servers.

Every cache miss is treated as an optimization opportunity.

---

# Cache Hierarchy

The platform follows a strict caching hierarchy.

```text
CPU Memory

↓

JavaScript Memory

↓

IndexedDB

↓

Browser HTTP Cache

↓

Cloudflare CDN

↓

GitHub Pages

↓

Cloudflare R2
```

Whenever possible, the system should satisfy requests from the highest available layer.

---

# Browser Memory

The fastest storage available.

Used for:

* current reader state
* current chapter
* active advertisement configuration
* loaded manifests
* navigation state
* current theme

Data stored here disappears when the browser tab closes.

---

# IndexedDB

IndexedDB is the primary long-term cache.

It stores information that should survive browser restarts.

Examples include:

* configuration
* manifests
* search indexes
* chapter metadata
* thumbnails
* user preferences
* recently viewed chapters

IndexedDB should always be preferred over repeated network requests.

---

# HTTP Cache

Static assets should be aggressively cached.

Examples include:

* JavaScript
* CSS
* Fonts
* Icons
* Logos

Immutable assets should never be revalidated.

Instead they should receive versioned filenames.

Example:

```text
reader.41.js

theme.12.css

search.8.js
```

Changing the filename invalidates the cache naturally.

---

# Cloudflare CDN

Cloudflare should serve the overwhelming majority of requests.

GitHub and R2 should rarely receive direct traffic.

Cloudflare exists to provide:

* global distribution
* edge caching
* bandwidth reduction
* lower latency

Origin requests should be uncommon.

---

# GitHub Pages

GitHub serves static website assets.

These include:

* HTML
* JavaScript
* CSS
* manifests
* configuration

Visitors should rarely communicate directly with GitHub due to Cloudflare caching.

---

# Cloudflare R2

R2 is responsible only for media storage.

Examples include:

* page images
* covers
* artwork
* thumbnails

R2 should never store business logic.

R2 should not determine reader behavior.

The browser should already know how to render the chapter before requesting the first image.

---

# Immutable Assets

Immutable assets are never modified.

Instead, new versions are created.

Example:

```text
reader-v1.js

↓

reader-v2.js
```

Never overwrite immutable assets.

Versioning removes the need for manual cache invalidation.

---

# Configuration

Configuration changes infrequently.

Examples include:

* advertisement policy
* themes
* experiments
* feature flags

Configuration should be downloaded once.

It should then be stored locally.

Future page loads should reuse cached configuration whenever possible.

---

# Manifest Strategy

A lightweight manifest determines whether configuration has changed.

Example:

```json
{
    "config": 18,
    "search": 4,
    "theme": 7
}
```

The browser compares local versions against the manifest.

Only outdated resources are downloaded.

Everything else remains cached.

---

# Chapter Loading

The reader should never download more than necessary.

The loading sequence should resemble:

```text
Load Chapter Metadata

↓

Render First Pages

↓

Preload Next Images

↓

Display Current Page

↓

Discard Distant Images

↓

Continue Reading
```

Images should be loaded only when approaching visibility.

---

# Prefetching

The reader should anticipate navigation.

While reading:

Chapter 1

the browser may begin downloading:

* Chapter 2 metadata
* Cover artwork
* Navigation information

This minimizes perceived loading time.

---

# Lazy Loading

Images should only download when needed.

Pages outside the visible reading window should not consume bandwidth.

The reader determines when images become necessary.

---

# Configuration Lifetime

Configuration should remain cached until a newer version exists.

The browser should avoid requesting configuration on every chapter.

Instead:

```text
Browser Starts

↓

Configuration Exists

↓

Yes

↓

Use Cached Version

↓

Check Manifest

↓

Configuration Current

↓

Continue
```

No additional downloads occur.

---

# Reader State

The browser should preserve useful reader information.

Examples include:

* last chapter
* reading direction
* theme
* zoom level
* language
* preferred quality

Reader state should remain local.

The server does not require this information.

---

# Network Philosophy

Every network request should satisfy one of three conditions.

1. New content.

2. Updated configuration.

3. Missing cached data.

All other requests should be avoided.

---

# Scalability

The caching strategy should remain effective regardless of traffic volume.

The architecture should behave similarly whether serving:

100 readers

10,000 readers

1,000,000 readers

or more.

Growth should primarily increase CDN utilization rather than application complexity.

---

# Design Rules

The following rules guide all future development.

* Cache first.
* Download once.
* Reuse indefinitely.
* Prefer browser storage over network traffic.
* Prefer CDN over origin.
* Prefer immutable assets over cache invalidation.
* Prefer manifests over repeated downloads.
* Prefer static deployment over dynamic generation.
* Never duplicate work already performed.

---

# Long-Term Vision

The ideal visitor downloads the reader once.

Downloads configuration once.

Downloads each chapter only once.

After that, navigation is driven primarily by local storage, browser cache, and CDN edge nodes.

The browser becomes the application.

The network simply delivers new content.

By treating bandwidth as a scarce resource and caching as a first-class architectural concern, the platform remains fast, inexpensive to operate, and capable of serving large audiences without proportional increases in infrastructure complexity.
